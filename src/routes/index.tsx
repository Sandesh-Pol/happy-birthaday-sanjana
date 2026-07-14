import { createFileRoute } from "@tanstack/react-router";
import SanjanaExperience from "@/components/sanjana/SanjanaExperience";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <SanjanaExperience />;
}
