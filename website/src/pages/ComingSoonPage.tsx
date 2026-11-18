import { colors } from "@app/constants/theme";
import { Ionicon } from "@/components/icons/Icon";
import { GradientButton } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { useAppNavigate } from "@/routes/navigation";

// Stand-in for sections that are built in later phases, so every link from
// the finished screens already resolves to a real URL.
export default function ComingSoonPage({ title, phase, icon = "construct-outline", back = true }: { title: string; phase: number; icon?: string; back?: boolean }) {
  const navigate = useAppNavigate();
  return (
    <div className="mx-auto max-w-6xl lg:px-8 lg:pt-6">
      <PageHeader title={title} back={back} />
      <div className="px-4 pt-10 sm:px-6 lg:px-0">
        <div className="card mx-auto flex max-w-md flex-col items-center p-8 text-center">
          <span className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-light">
            <Ionicon name={icon} size={34} color={colors.primaryDark} />
          </span>
          <h2 className="text-xl font-extrabold text-ink">{title}</h2>
          <p className="mt-2 text-[15px] text-muted">This part of the HitLit website is arriving in Phase {phase}.</p>
          <GradientButton className="mt-6 w-full" onClick={() => navigate("/", { state: { tab: "home" } })}>
            Back to Home
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
