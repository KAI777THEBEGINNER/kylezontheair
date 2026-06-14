"use client";

interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  /** "pill" = 圆形胶囊（短文本），"rect" = 圆角矩形（长文本/建议芯片） */
  variant?: "pill" | "rect";
}

export default function CapsuleButton({
  children,
  onClick,
  className = "",
  variant = "pill",
}: Props) {
  const isPill = variant === "pill";

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center
        ${isPill ? "rounded-full" : "rounded-xl"}
        border border-white/40
        bg-transparent
        ${isPill ? "px-3 py-1.5" : "px-4 py-2"}
        text-white text-[14px] md:text-[16px]
        ${isPill ? "whitespace-nowrap" : "whitespace-normal text-left"}
        transition-all duration-150 ease-out
        hover:bg-white/10 hover:border-white/60
        active:scale-[0.97]
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
