import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VCI Prediction Dashboard | GIS Tool",
  description: "Interactive dashboard for predicting VCI using 2022 multi-quarter raster data and autogluon machine learning models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
