import { useState } from "react";
import { Button, Modal, Spinner } from "./ui";
import { useAuth } from "../lib/auth";
import { track } from "../lib/analytics";

const STEPS = [
  {
    title: "Bienvenido a Divido",
    text: "La app para repartir gastos en grupo y saldar deudas sin fricción.",
    icon: (
      <svg className="h-12 w-12 mx-auto text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" />
      </svg>
    ),
  },
  {
    title: "Crea tu primer grupo",
    text: "Invita a tus compañeros, elige la moneda y empieza a añadir gastos compartidos.",
    icon: (
      <svg className="h-12 w-12 mx-auto text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Añade gastos y ve saldos",
    text: "Divido calcula quién debe qué y optimiza los pagos al mínimo de transferencias.",
    icon: (
      <svg className="h-12 w-12 mx-auto text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function OnboardingModal() {
  const { dismissOnboarding } = useAuth();
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else dismiss();
  };

  const dismiss = () => {
    track("onboarding_completed", { steps: STEPS.length });
    dismissOnboarding();
  };

  const current = STEPS[step];

  if (!step && !document.documentElement.classList.contains("onboarding-active")) {
    document.documentElement.classList.add("onboarding-active");
  }

  return (
    <Modal
      open
      onClose={dismiss}
      title={current.title}
      footer={
        <div className="w-full flex justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Atrás
            </Button>
          ) : null}
          <Button
            onClick={next}
            className="flex-1 justify-center"
          >
            {step === STEPS.length - 1 ? "Empezar" : "Siguiente"}
          </Button>
        </div>
      }
    >
      <div className="text-center">
        <div className="mb-6">{current.icon}</div>
        <p className="text-base text-slate-300 leading-relaxed">{current.text}</p>
        <div className="mt-8 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              disabled
              className={`h-2 w-8 rounded-full transition ${i === step ? "bg-indigo-400" : "bg-slate-700"}`}
              aria-label={`Paso ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}