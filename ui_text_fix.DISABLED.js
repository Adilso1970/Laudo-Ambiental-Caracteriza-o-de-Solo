(function () {
  function mojibakeScore(text) {
    const value = String(text || "");
    const matches = value.match(/[ÃÂâ�ƒ]/g);
    return matches ? matches.length : 0;
  }

  function genericRepair(text) {
    if (typeof text !== "string" || !text) return text;

    let current = text;

    for (let i = 0; i < 4; i += 1) {
      if (!/[ÃÂâ�ƒ]/.test(current)) break;

      try {
        const repaired = decodeURIComponent(escape(current));
        if (mojibakeScore(repaired) < mojibakeScore(current)) {
          current = repaired;
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }

    return current;
  }

  const phraseMap = [
    ["Projeto em edi\u00C3\u00A7\u00C3\u00A3o", "Projeto em edi\u00E7\u00E3o"],
    ["Projeto em edi\u00C3\u0192\u00C2\u00A7\u00C3\u0192\u00C2\u00A3o", "Projeto em edi\u00E7\u00E3o"],

    ["FLUXO T\u00C3\u0089CNICO DO LAUDO", "FLUXO T\u00C9CNICO DO LAUDO"],
    ["FLUXO T\u00C3\u0192\u00E2\u20AC\u00B0CNICO DO LAUDO", "FLUXO T\u00C9CNICO DO LAUDO"],

    ["LEITURA T\u00C3\u0089CNICA AUTOM\u00C3\u0081TICA", "LEITURA T\u00C9CNICA AUTOM\u00C1TICA"],
    ["LEITURA T\u00C3\u0192\u00E2\u20AC\u00B0CNICA AUTOM\u00C3\u0192\u00E2\u20AC\u00B0TICA", "LEITURA T\u00C9CNICA AUTOM\u00C1TICA"],

    ["Resumo t\u00C3\u00A9cnico do projeto atual", "Resumo t\u00E9cnico do projeto atual"],
    ["Resumo t\u00C3\u0192\u00C2\u00A9cnico do projeto atual", "Resumo t\u00E9cnico do projeto atual"],

    ["OCORR\u00C3\u008ANCIAS", "OCORR\u00CANCIAS"],
    ["OCORR\u00C3\u0192\u00E2\u20AC\u00B0NCIAS", "OCORR\u00CANCIAS"],

    ["SITUA\u00C3\u0087\u00C3\u0083O T\u00C3\u0089CNICA", "SITUA\u00C7\u00C3O T\u00C9CNICA"],
    ["SITUA\u00C3\u0192\u00C2\u00A7\u00C3\u0192\u00C2\u00A3O T\u00C3\u0192\u00E2\u20AC\u00B0CNICA", "SITUA\u00C7\u00C3O T\u00C9CNICA"],

    ["REVIS\u00C3\u0083O T\u00C3\u0089CNICA", "REVIS\u00C3O T\u00C9CNICA"],
    ["REVIS\u00C3\u0192\u00C2\u00A3O T\u00C3\u0192\u00E2\u20AC\u00B0CNICA", "REVIS\u00C3O T\u00C9CNICA"],

    ["PEND\u00C3\u008ANCIA T\u00C3\u0089CNICA EM ABERTO", "PEND\u00CANCIA T\u00C9CNICA EM ABERTO"],
    ["PEND\u00C3\u0192\u00E2\u20AC\u00B0NCIA T\u00C3\u0192\u00E2\u20AC\u00B0CNICA EM ABERTO", "PEND\u00CANCIA T\u00C9CNICA EM ABERTO"],

    ["Pend\u00C3\u00AAncia detectada", "Pend\u00EAncia detectada"],
    ["Pend\u00C3\u0192\u00C2\u00AAncia detectada", "Pend\u00EAncia detectada"],

    ["pend\u00C3\u00AAncias t\u00C3\u00A9cnicas", "pend\u00EAncias t\u00E9cnicas"],
    ["pend\u00C3\u0192\u00C2\u00AAncias t\u00C3\u0192\u00C2\u00A9cnicas", "pend\u00EAncias t\u00E9cnicas"],

    ["PR\u00C3\u0093XIMO PASSO SUGERIDO", "PR\u00D3XIMO PASSO SUGERIDO"],
    ["PR\u00C3\u0192\u00C2\u00B3XIMO PASSO SUGERIDO", "PR\u00D3XIMO PASSO SUGERIDO"],

    ["Pr\u00C3\u00B3ximo passo", "Pr\u00F3ximo passo"],
    ["Pr\u00C3\u0192\u00C2\u00B3ximo passo", "Pr\u00F3ximo passo"],

    ["dados t\u00C3\u00A9cnicos", "dados t\u00E9cnicos"],
    ["dados t\u00C3\u0192\u00C2\u00A9cnicos", "dados t\u00E9cnicos"],

    ["M\u00C3\u0093DULO ATUAL", "M\u00D3DULO ATUAL"],
    ["M\u00C3\u0192\u00E2\u20AC\u0153DULO ATUAL", "M\u00D3DULO ATUAL"],

    ["\u00C3\u0081gua", "\u00C1gua"],
    ["\u00C3\u0192gua", "\u00C1gua"],
    ["\u00C3\u0192\u00C1gua", "\u00C1gua"],
    ["\u00C3\u0192\u00C2\u00C1gua", "\u00C1gua"],

    ["Evid\u00C3\u00AAncias", "Evid\u00EAncias"],
    ["Evid\u00C3\u0192\u00C2\u00AAncias", "Evid\u00EAncias"],

    ["Vegeta\u00C3\u00A7\u00C3\u00A3o", "Vegeta\u00E7\u00E3o"],
    ["Vegeta\u00C3\u0192\u00C2\u00A7\u00C3\u0192\u00C2\u00A3o", "Vegeta\u00E7\u00E3o"],

    ["ESP\u00C3\u0089CIE", "ESP\u00C9CIE"],
    ["ESP\u00C3\u0192\u00E2\u20AC\u00B0CIE", "ESP\u00C9CIE"],

    ["Esp\u00C3\u00A9cie", "Esp\u00E9cie"],
    ["esp\u00C3\u00A9cie", "esp\u00E9cie"],

    ["M\u00C3\u0089TODO", "M\u00C9TODO"],
    ["M\u00C3\u0192\u00E2\u20AC\u00B0TODO", "M\u00C9TODO"],

    ["M\u00C3\u00A9todo", "M\u00E9todo"],
    ["m\u00C3\u00A9todo", "m\u00E9todo"],

    ["AMEA\u00C3\u0087ADA", "AMEA\u00C7ADA"],
    ["AMEA\u00C3\u0192\u00E2\u20AC\u00A1ADA", "AMEA\u00C7ADA"],

    ["Amea\u00C3\u00A7ada", "Amea\u00E7ada"],
    ["amea\u00C3\u00A7ada", "amea\u00E7ada"],

    ["N\u00C3\u00A3o sei", "N\u00E3o sei"],
    ["n\u00C3\u00A3o sei", "n\u00E3o sei"],

    ["\u00C3\u00A2\u0080\u0094", "\u2014"],
    ["\u00C3\u00A2\u0080\u0093", "\u2013"],
    ["\u00C3\u00A2\u0080\u00A6", "\u2026"],

    ["\u00E2\u0080\u0094", "\u2014"],
    ["\u00E2\u0080\u0093", "\u2013"],
    ["\u00E2\u0080\u00A6", "\u2026"]
  ];

  function repairText(text) {
    let out = String(text == null ? "" : text);
    out = genericRepair(out);

    for (const [from, to] of phraseMap) {
      out = out.split(from).join(to);
    }

    return out;
  }

  function normalizeNodeTexts(root) {
    if (!root) return;

    try {
      document.title = repairText(document.title);
    } catch (error) {}

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    for (const node of textNodes) {
      const before = node.nodeValue;
      const after = repairText(before);
      if (after !== before) {
        node.nodeValue = after;
      }
    }

    const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of elements) {
      for (const attr of ["title", "placeholder", "aria-label"]) {
        const before = el.getAttribute && el.getAttribute(attr);
        if (typeof before === "string" && before) {
          const after = repairText(before);
          if (after !== before) {
            el.setAttribute(attr, after);
          }
        }
      }
    }
  }

  function boot() {
    normalizeNodeTexts(document.body);

    const target = document.body || document.documentElement;
    if (!target) return;

    const observer = new MutationObserver(() => {
      normalizeNodeTexts(document.body);
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });

    setTimeout(() => normalizeNodeTexts(document.body), 50);
    setTimeout(() => normalizeNodeTexts(document.body), 200);
    setTimeout(() => normalizeNodeTexts(document.body), 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();