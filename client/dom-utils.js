(function exposeDomUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.MotekDomUtils = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
function setMessage(element, { text = "", kind = "status", actions = [] } = {}) {
  if (!element) return;

  element.replaceChildren();
  element.dataset.kind = kind;
  element.setAttribute("role", kind === "error" ? "alert" : "status");
  element.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  const document = element.ownerDocument;

  if (text) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    element.appendChild(paragraph);
  }

  if (actions.length) {
    const actionList = document.createElement("div");
    actionList.className = "storage-message__actions";
    actions.forEach(({ label, onClick, primary = false }) => {
      const button = document.createElement("button");
      button.className = primary ? "button" : "button button--ghost";
      button.type = "button";
      button.textContent = label;
      if (typeof onClick === "function") button.addEventListener("click", onClick);
      actionList.appendChild(button);
    });
    element.appendChild(actionList);
  }
}

function clearMessage(element) {
  if (!element) return;
  element.replaceChildren();
  delete element.dataset.kind;
  element.removeAttribute("role");
  element.removeAttribute("aria-live");
}

  return { setMessage, clearMessage };
});
