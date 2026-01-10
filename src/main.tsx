import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Guard against rare DOM races (e.g. portal/toast libraries) that can throw
// NotFoundError: Failed to execute 'removeChild'/'insertBefore' on 'Node'.
// This prevents a full blank-screen crash and logs useful diagnostics.
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChildPatched(child: Node) {
    try {
      if (child && child.parentNode !== this) {
        console.warn("[dom-guard] removeChild: child not in parent", { child, parent: this });
        return child;
      }
      return originalRemoveChild.call(this, child);
    } catch (err) {
      console.warn("[dom-guard] removeChild threw", err);
      return child;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBeforePatched(newNode: Node, referenceNode: Node | null) {
    try {
      if (referenceNode && referenceNode.parentNode !== this) {
        console.warn("[dom-guard] insertBefore: reference not in parent", {
          newNode,
          referenceNode,
          parent: this,
        });
        return newNode;
      }
      return originalInsertBefore.call(this, newNode, referenceNode);
    } catch (err) {
      console.warn("[dom-guard] insertBefore threw", err);
      return newNode;
    }
  };
}

createRoot(document.getElementById("root")!).render(<App />);

