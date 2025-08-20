import TestLayout from "../components/layout/TestLayout";

export default function TestComponentsRouteLayout({ children }: { children: React.ReactNode }) {
  return <TestLayout maxWidth="md">{children}</TestLayout>;
}