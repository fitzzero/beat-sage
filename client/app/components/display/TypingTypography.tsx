"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Typography, { type TypographyProps } from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";

type VariableSpeed = { min: number; max: number };

export type TypingTypographyProps = TypographyProps & {
  text: string | string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  loop?: boolean; // default false for chat: type once
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: React.ReactNode;
  cursorBlinkDuration?: number; // seconds
  cursorClassName?: string;
  textColors?: string[];
  variableSpeed?: VariableSpeed;
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  autoHideCursorOnDone?: boolean; // default true
  onComplete?: () => void; // called once when fully typed and not looping
};

export default function TypingTypography({
  text,
  typingSpeed = 50,
  deletingSpeed = 30,
  initialDelay = 0,
  pauseDuration = 2000,
  loop = false,
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorBlinkDuration = 0.5,
  cursorClassName,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  autoHideCursorOnDone = true,
  onComplete,
  sx,
  ...typographyProps
}: TypingTypographyProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const [didComplete, setDidComplete] = useState(false);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  const textArray = useMemo(
    () => (Array.isArray(text) ? text : [text]),
    [text]
  );

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) {
      return typingSpeed;
    }
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  // Compute current text color if provided; apply via sx.color on Typography
  const currentTextColor = useMemo(() => {
    if (textColors.length === 0) {
      return undefined;
    }
    return textColors[currentTextIndex % textColors.length];
  }, [textColors, currentTextIndex]);

  // Respect reduced motion: render full text, no cursor animation
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)"
  );

  // Observe visibility when requested
  useEffect(() => {
    if (!startOnVisible || !containerRef.current) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  // Cursor blink via CSS keyframes only (no GSAP)
  useEffect(() => {
    if (!showCursor || !cursorRef.current) {
      return;
    }
    // No-op: CSS animation is declared inline below
  }, [showCursor]);

  // Typing/deleting state machine
  useEffect(() => {
    if (!isVisible) {
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const currentText = textArray[currentTextIndex];
    const processedText = currentText;

    const execute = () => {
      if (isDeleting) {
        if (displayedText === "") {
          setIsDeleting(false);
          if (onSentenceComplete) {
            onSentenceComplete(textArray[currentTextIndex], currentTextIndex);
          }
          if (currentTextIndex === textArray.length - 1 && !loop) {
            return;
          }
          setCurrentTextIndex((prev) => (prev + 1) % textArray.length);
          setCurrentCharIndex(0);
          timeout = setTimeout(() => {}, pauseDuration);
        } else {
          timeout = setTimeout(() => {
            setDisplayedText((prev) => prev.slice(0, -1));
          }, deletingSpeed);
        }
      } else {
        if (currentCharIndex < processedText.length) {
          timeout = setTimeout(
            () => {
              setDisplayedText(
                (prev) => prev + processedText[currentCharIndex]
              );
              setCurrentCharIndex((prev) => prev + 1);
            },
            variableSpeed ? getRandomSpeed() : typingSpeed
          );
        } else if (textArray.length > 1 || loop) {
          timeout = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        } else if (!loop && !didComplete) {
          setDidComplete(true);
          onComplete?.();
        }
      }
    };

    if (currentCharIndex === 0 && !isDeleting && displayedText === "") {
      if (initialDelay > 0) {
        timeout = setTimeout(execute, initialDelay);
      } else {
        execute();
      }
    } else {
      execute();
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    variableSpeed,
    onSentenceComplete,
    getRandomSpeed,
    didComplete,
    onComplete,
  ]);

  // Reset when text prop changes
  useEffect(() => {
    setDisplayedText("");
    setCurrentCharIndex(0);
    setIsDeleting(false);
    setCurrentTextIndex(0);
    setDidComplete(false);
  }, [text]);

  const finishedCurrent =
    currentCharIndex >= (textArray[currentTextIndex] || "").length &&
    !isDeleting;
  const shouldHideCursor =
    (hideCursorWhileTyping &&
      (currentCharIndex < textArray[currentTextIndex].length || isDeleting)) ||
    (autoHideCursorOnDone && !loop && finishedCurrent) ||
    prefersReducedMotion;

  return (
    <Typography
      component="span"
      ref={containerRef}
      sx={{
        display: "inline-block",
        whiteSpace: "pre-wrap",
        color: currentTextColor,
        ...sx,
      }}
      {...typographyProps}
    >
      {prefersReducedMotion
        ? Array.isArray(text)
          ? text[0]
          : text
        : displayedText}
      {showCursor && (
        <span
          ref={cursorRef}
          className={cursorClassName}
          style={{
            marginLeft: "0.25rem",
            display: shouldHideCursor ? "none" : "inline-block",
            opacity: 1,
            // Blink via CSS only
            animation: cursorBlinkDuration
              ? `typing-cursor-blink ${cursorBlinkDuration}s ease-in-out infinite alternate`
              : undefined,
          }}
        >
          {cursorCharacter}
        </span>
      )}
      {/* Inline @keyframes to avoid GlobalStyles dependency */}
      <style>{`
@keyframes typing-cursor-blink { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
    </Typography>
  );
}
