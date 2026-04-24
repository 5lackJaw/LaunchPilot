"use client";

import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { InterviewAnswer } from "@/server/schemas/interview";
import { saveInterviewAnswerAction, type InterviewSaveState } from "@/app/onboarding/interview/actions";
import { interviewQuestions } from "@/app/onboarding/interview/interview-questions";

type Answers = Partial<Record<string, string>>;

const initialSaveState: InterviewSaveState = {
  status: "idle",
};

export function InterviewFlow({ productId, initialAnswers }: { productId: string; initialAnswers: InterviewAnswer[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, formAction] = useActionState(handleSaveAnswer, initialSaveState);
  const [answers, setAnswers] = useState<Answers>(() =>
    Object.fromEntries(initialAnswers.map((answer) => [answer.questionId, answer.answer])),
  );
  const [savedAnswers, setSavedAnswers] = useState<Answers>(() =>
    Object.fromEntries(initialAnswers.map((answer) => [answer.questionId, answer.answer])),
  );
  const activeQuestion = interviewQuestions[activeIndex];
  const completedCount = useMemo(
    () => interviewQuestions.filter((question) => savedAnswers[question.id]?.trim()).length,
    [savedAnswers],
  );
  const progressPercent = Math.round((completedCount / interviewQuestions.length) * 100);
  const activeAnswer = answers[activeQuestion.id] ?? "";
  const hasUnsavedChange = (savedAnswers[activeQuestion.id] ?? "") !== activeAnswer;

  async function handleSaveAnswer(previousState: InterviewSaveState, formData: FormData) {
    const nextState = await saveInterviewAnswerAction(previousState, formData);

    if (nextState.status === "success" && nextState.savedQuestionId) {
      setSavedAnswers((current) => ({
        ...current,
        [nextState.savedQuestionId as string]: String(formData.get("answer") ?? ""),
      }));
    }

    return nextState;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{activeQuestion.prompt}</CardTitle>
              <CardDescription>{activeQuestion.helper}</CardDescription>
            </div>
            <Badge variant="secondary">
              {activeIndex + 1}/{interviewQuestions.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-5">
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>Answer was not saved</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "success" ? (
            <Alert>
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="questionId" value={activeQuestion.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={activeQuestion.id}>Answer</Label>
            <textarea
              id={activeQuestion.id}
              name="answer"
              value={answers[activeQuestion.id] ?? ""}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [activeQuestion.id]: event.target.value,
                }))
              }
              className="min-h-40 rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground"
              placeholder="Write a plain answer here."
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Example answers</p>
            <div className="flex flex-wrap gap-2">
              {activeQuestion.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() =>
                    setAnswers((current) => ({
                      ...current,
                      [activeQuestion.id]: example,
                    }))
                  }
                  className="rounded-full border bg-secondary px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            >
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <SaveButton hasUnsavedChange={hasUnsavedChange} />
              <Button
                type="button"
                disabled={activeIndex === interviewQuestions.length - 1 || hasUnsavedChange}
                onClick={() => setActiveIndex((index) => Math.min(interviewQuestions.length - 1, index + 1))}
              >
                Next
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interview progress</CardTitle>
          <CardDescription>Saved answers can be resumed later.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>{completedCount} answered</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="flex flex-col gap-2">
            {interviewQuestions.map((question, index) => {
              const isAnswered = Boolean(savedAnswers[question.id]?.trim());
              const isActive = index === activeIndex;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="flex items-center gap-2 rounded-md border bg-secondary px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  data-active={isActive}
                >
                  {isAnswered ? <CheckCircle2 className="text-accent" /> : <span className="size-4 rounded-full border" />}
                  <span className="min-w-0 flex-1 truncate">{question.prompt}</span>
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">Product ID {productId}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SaveButton({ hasUnsavedChange }: { hasUnsavedChange: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={hasUnsavedChange ? "default" : "secondary"} disabled={pending || !hasUnsavedChange}>
      {pending ? "Saving..." : hasUnsavedChange ? "Save answer" : "Saved"}
    </Button>
  );
}
