import { Boxes, Command, IndianRupee, ShoppingBag, Truck } from "lucide-react";

const stages = [ShoppingBag, Boxes, Truck, IndianRupee];

export function GlobalLoader({ label = "Preparing your workspace", inline = false }) {
  return (
    <div
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
      className={`global-loader${inline ? " global-loader-inline" : ""}`}
      role="status"
    >
      <div className="global-loader-content">
        <div className="global-loader-lockup">
          <span className="global-loader-mark" aria-hidden="true"><Command size={19} strokeWidth={2.4} /></span>
          <span><strong>Commerce OS</strong><small>Operations workspace</small></span>
        </div>

        <div className="global-loader-flow" aria-hidden="true">
          <span className="global-loader-track"><i /></span>
          <ol>
            {stages.map((Icon, index) => (
              <li key={index}><span><Icon size={15} /></span></li>
            ))}
          </ol>
        </div>

        <p>{label}<span aria-hidden="true">…</span></p>
      </div>
    </div>
  );
}
