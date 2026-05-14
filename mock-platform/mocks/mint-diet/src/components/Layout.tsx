import type { FC } from "hono/jsx";
import { CSS } from "../styles";

export const Layout: FC<{ title: string; children: unknown }> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — Mint Diet</title>
      <style>{CSS}</style>
    </head>
    <body>
      <nav>
        <a href="/log">Diet Log</a>
        <a href="/plans">Meal Plans</a>
      </nav>
      <div class="container">{children}</div>
    </body>
  </html>
);
