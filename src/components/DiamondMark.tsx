import React from "react";

/** Elemento de assinatura visual do sistema: um diamante facetado em linhas,
 * remetendo ao nome "Diamond Sect" sem depender de imagens externas. */
export function DiamondMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dsFacetA" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9FEAF2" />
          <stop offset="100%" stopColor="#5FD8E6" />
        </linearGradient>
        <linearGradient id="dsFacetB" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E4CFA0" />
          <stop offset="100%" stopColor="#C9A66B" />
        </linearGradient>
      </defs>
      <polygon points="8,20 32,6 56,20 32,26" fill="url(#dsFacetA)" opacity="0.9" />
      <polygon points="8,20 32,26 24,58" fill="url(#dsFacetA)" opacity="0.55" />
      <polygon points="56,20 32,26 40,58" fill="url(#dsFacetB)" opacity="0.75" />
      <polygon points="32,26 24,58 32,62 40,58" fill="url(#dsFacetB)" opacity="0.95" />
      <polygon points="8,20 32,6 56,20 40,58 32,62 24,58" fill="none" stroke="#0C0E13" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
