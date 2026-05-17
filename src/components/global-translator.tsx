"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import { translatePhrase } from "@/lib/phrase-i18n";

const originalText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();
const translatedMark = "data-i18n-auto";
const attrs = ["placeholder", "title", "aria-label", "alt"];

function getOriginalAttr(element: Element, attr: string) {
  let map = originalAttrs.get(element);
  if (!map) {
    map = new Map();
    originalAttrs.set(element, map);
  }

  if (!map.has(attr)) map.set(attr, element.getAttribute(attr) ?? "");
  return map.get(attr) ?? "";
}

function translateElementAttributes(element: Element, lang: "en" | "ru") {
  if (element.closest("[data-no-auto-translate]")) return;

  attrs.forEach((attr) => {
    if (!element.hasAttribute(attr)) return;
    const original = getOriginalAttr(element, attr);
    const next = translatePhrase(original, lang);
    if (next !== element.getAttribute(attr)) element.setAttribute(attr, next);
  });
}

function translateTextNode(node: Text, lang: "en" | "ru") {
  const parent = node.parentElement;
  if (!parent || parent.closest("[data-no-auto-translate]")) return;
  if (["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"].includes(parent.tagName)) return;

  if (!originalText.has(node)) originalText.set(node, node.nodeValue ?? "");
  const original = originalText.get(node) ?? "";
  const next = translatePhrase(original, lang);
  if (next !== node.nodeValue) {
    node.nodeValue = next;
    parent.setAttribute(translatedMark, "true");
  }
}

function translateTree(root: ParentNode, lang: "en" | "ru") {
  if (root instanceof Element) translateElementAttributes(root, lang);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, lang);
    else translateElementAttributes(node as Element, lang);
    node = walker.nextNode();
  }
}

export function GlobalTranslator() {
  const lang = useAppStore((s) => s.lang);

  useEffect(() => {
    const refreshRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    window.addEventListener("pageshow", refreshRestoredPage);
    return () => window.removeEventListener("pageshow", refreshRestoredPage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    translateTree(document.body, lang);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
          const textNode = mutation.target as Text;
          const original = originalText.get(textNode);
          const translatedOriginal = original ? translatePhrase(original, lang) : "";
          const current = textNode.nodeValue ?? "";

          if (!original || (current !== original && current !== translatedOriginal)) {
            originalText.set(textNode, current);
          }
          translateTextNode(textNode, lang);
          continue;
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element && mutation.attributeName) {
          translateElementAttributes(mutation.target, lang);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, lang);
          else if (node instanceof Element) translateTree(node, lang);
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: attrs,
    });

    return () => observer.disconnect();
  }, [lang]);

  return null;
}
