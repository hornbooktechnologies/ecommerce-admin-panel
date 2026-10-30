"use client";

import { Children, cloneElement, isValidElement } from "react";
import "./product-setup.css";

// Keep the existing controls/payloads, adding stable labels for validation.
// Each error stays beside its control as well as in the linked step summary.
export function ProductSetupFields({ children, prefix, errors = [] }) {
  function enhance(nodes, path) {
    return Children.map(nodes, (node, index) => {
      if (!isValidElement(node)) return node;
      const key = `${path}-${index}`;
      if (["input", "select", "textarea"].includes(node.type)) {
        const id = node.props.id || key, issue = errors.find(error => error.id === id);
        return <>{cloneElement(node, { id, "aria-invalid": issue ? true : undefined,
          "aria-describedby": [node.props["aria-describedby"], issue ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined })}
          {issue ? <span className="setup-field-error" id={`${id}-error`}>{issue.message}</span> : null}</>;
      }
      return node.props.children ? cloneElement(node, {}, enhance(node.props.children, key)) : node;
    });
  }
  return enhance(children, prefix);
}
