'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiRoutes, PublicCommentDto } from '@jazz-portfolio/shared';
import { PublicApiClient } from '@/lib/api-public';

interface UseCommentFormOptions {
  postId: string;
  postSlug: string;
  isCaptchaEnabled: boolean;
  onCommentSubmitted?: (comment: OptimisticComment) => void;
}

export interface OptimisticComment extends PublicCommentDto {
  isPendingModeration?: boolean;
}

export function useCommentForm({
  postId,
  postSlug,
  isCaptchaEnabled,
  onCommentSubmitted,
}: UseCommentFormOptions) {
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [content, setContent] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [replyToName, setReplyToName] = useState<string | null>(null);

  // Honeypots
  const [hp, setHp] = useState('');
  const [website, setWebsite] = useState('');

  // Security token & Dwell time
  const [token, setToken] = useState<string | null>(null);
  const [fetchingToken, setFetchingToken] = useState(true);
  const [tokenReceivedAt, setTokenReceivedAt] = useState<number | null>(null);
  const [dwellSecondsRemaining, setDwellSecondsRemaining] = useState<number>(5);
  const [isDwellTimeMet, setIsDwellTimeMet] = useState(false);

  // CAPTCHA
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load authorName and authorEmail from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('jazz_comment_author_name');
      const savedEmail = localStorage.getItem('jazz_comment_author_email');
      if (savedName) setAuthorName(savedName);
      if (savedEmail) setAuthorEmail(savedEmail);
    } catch {
      // Local storage unavailable
    }
  }, []);

  // Fetch security token & run 5-second dwell timer
  useEffect(() => {
    let active = true;
    async function loadToken() {
      setFetchingToken(true);
      try {
        const res = await PublicApiClient.get<{ token: string }>(
          ApiRoutes.blog.commentToken(postSlug),
        );
        if (active && res.data?.token) {
          setToken(res.data.token);
          setTokenReceivedAt(Date.now());
        }
      } catch (err: any) {
        if (active) {
          setFeedback({
            type: 'error',
            text: 'Security token initialization failed. Please refresh.',
          });
        }
      } finally {
        if (active) setFetchingToken(false);
      }
    }

    void loadToken();

    return () => {
      active = false;
    };
  }, [postSlug]);

  // The server validates token age, so start dwell time after the token arrives.
  useEffect(() => {
    if (!tokenReceivedAt) return;

    setDwellSecondsRemaining(5);
    setIsDwellTimeMet(false);
    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - tokenReceivedAt) / 1000);
      const remaining = Math.max(0, 5 - elapsedSec);
      setDwellSecondsRemaining(remaining);
      if (remaining === 0) {
        setIsDwellTimeMet(true);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [tokenReceivedAt]);

  const handleReply = useCallback((commentId: string, author: string) => {
    setParentId(commentId);
    setReplyToName(author);
  }, []);

  const cancelReply = useCallback(() => {
    setParentId(null);
    setReplyToName(null);
  }, []);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isDwellTimeMet) return;

    // Check honeypot
    if (hp || website) {
      // Silent rejection for bots
      setFeedback({
        type: 'success',
        text: 'Comment submitted successfully! It is pending moderation review.',
      });
      setContent('');
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await PublicApiClient.post<{
        id: string;
        status: string;
        message: string;
      }>(ApiRoutes.blog.submitComment(), {
        postId,
        parentId,
        commentToken: token,
        authorName,
        authorEmail,
        content,
        captchaToken,
      });

      // Save credentials in localStorage
      try {
        localStorage.setItem('jazz_comment_author_name', authorName);
        localStorage.setItem('jazz_comment_author_email', authorEmail);
      } catch {
        // Ignore storage error
      }

      // Add optimistic comment preview if pending
      const isPending = res.data?.status === 'PENDING';
      const newComment: OptimisticComment = {
        id: res.data?.id || `opt-${Date.now()}`,
        parentId,
        authorName,
        content,
        createdAt: new Date().toISOString(),
        isPendingModeration: isPending,
      };

      setFeedback({
        type: 'success',
        text: res.data?.message || 'Comment posted successfully!',
      });
      setContent('');
      cancelReply();

      if (onCommentSubmitted) {
        onCommentSubmitted(newComment);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit comment.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setSubmitting(false);
      if (isCaptchaEnabled) {
        setCaptchaToken(null);
        setCaptchaResetKey((current) => current + 1);
      }
    }
  };

  const refetchToken = async () => {
    setFetchingToken(true);
    setFeedback(null);
    try {
      const res = await PublicApiClient.get<{ token: string }>(
        ApiRoutes.blog.commentToken(postSlug),
      );
      if (res.data?.token) {
        setToken(res.data.token);
        setTokenReceivedAt(Date.now());
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Security token initialization failed. Please try again.',
      });
    } finally {
      setFetchingToken(false);
    }
  };

  return {
    authorName,
    setAuthorName,
    authorEmail,
    setAuthorEmail,
    content,
    setContent,
    parentId,
    replyToName,
    handleReply,
    cancelReply,
    hp,
    setHp,
    website,
    setWebsite,
    token,
    fetchingToken,
    refetchToken,
    dwellSecondsRemaining,
    isDwellTimeMet,
    submitting,
    feedback,
    captchaToken,
    captchaResetKey,
    setCaptchaToken,
    submitComment,
  };
}
