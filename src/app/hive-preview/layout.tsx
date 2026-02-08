import '../globals.css';

export default function HivePreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#07080a]">{children}</body>
    </html>
  );
}
