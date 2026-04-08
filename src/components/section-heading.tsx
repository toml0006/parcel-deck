type SectionHeadingProps = {
  caption: string;
  description: string;
  title: string;
};

export function SectionHeading({ caption, description, title }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{caption}</p>
      <h2 className="font-display text-3xl text-slate-950">{title}</h2>
      <p className="max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}
