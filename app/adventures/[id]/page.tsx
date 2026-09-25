import ModuleWorkspace from "@/components/module-workspace";
export default async function AdventurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ModuleWorkspace id={id} />;
}
