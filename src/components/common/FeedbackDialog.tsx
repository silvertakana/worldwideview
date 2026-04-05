"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Paperclip, Upload } from "lucide-react";
import { useStore } from "@/core/state/store";
import { getCapturedLogs } from "@/lib/logCatcher";
import styles from "./FeedbackDialog.module.css";
import { trackEvent } from "@/lib/analytics";

export function FeedbackDialog() {
    const feedbackDialogOpen = useStore((s) => s.feedbackDialogOpen);
    const setFeedbackDialogOpen = useStore((s) => s.setFeedbackDialogOpen);

    const [type, setType] = useState("Bug Report");
    const [description, setDescription] = useState("");
    const [steps, setSteps] = useState("");
    const [attachLogs, setAttachLogs] = useState(true);
    const [email, setEmail] = useState("");
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [takingScreenshot, setTakingScreenshot] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const savedEmail = localStorage.getItem("wwv_feedback_email");
        if (savedEmail) {
            setEmail(savedEmail);
        }
    }, []);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        localStorage.setItem("wwv_feedback_email", newEmail);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const readers = files.map(file => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve((event.target?.result as string) || "");
                };
                reader.readAsDataURL(file);
            });
        });

        Promise.all(readers).then(dataUrls => {
            setScreenshots(prev => [...prev, ...dataUrls.filter(Boolean)]);
        });
        
        // Reset input
        e.target.value = "";
    };

    const handleTakeScreenshot = async () => {
        setTakingScreenshot(true);
        
        // Wait for React to render the hidden dialog state
        await new Promise(r => setTimeout(r, 50));

        try {
            // @ts-ignore - preferCurrentTab is a recent addition
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { preferCurrentTab: true } });
            const video = document.createElement("video");
            video.srcObject = stream;
            video.play();
            
            await new Promise((resolve) => {
                video.onloadedmetadata = resolve;
            });

            // Wait a brief moment for the video frame to stabilize
            await new Promise(r => setTimeout(r, 100));

            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                setScreenshots(prev => [...prev, canvas.toDataURL("image/jpeg", 0.9)]);
            }
            
            stream.getTracks().forEach(t => t.stop());
        } catch (err) {
            console.error("Screen capture failed or was cancelled:", err);
        } finally {
            setTakingScreenshot(false);
        }
    };

    const removeScreenshot = (index: number) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index));
    };

    if (!feedbackDialogOpen || takingScreenshot) return null;

    const isFormValid = description.length >= 10;

    const handleSubmit = async () => {
        if (!isFormValid) return;
        
        setIsSubmitting(true);
        try {
            const payload = {
                type,
                description,
                steps,
                attachLogs,
                logData: attachLogs ? getCapturedLogs() : undefined,
                email,
                screenshots,
                timestamp: new Date().toISOString(),
            };

            const webhookUrl = process.env.NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL || "https://n8n.arfquant.com/webhook-test/feedback";
            
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            trackEvent("submit-feedback", { type });

            // Reset state
            setDescription("");
            setSteps("");
            setType("Bug Report");
            setScreenshots([]);
            setFeedbackDialogOpen(false);
        } catch (error) {
            console.error("Failed to submit feedback:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={() => setFeedbackDialogOpen(false)}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.title}>Provide Feedback</div>
                    <button className={styles.closeButton} onClick={() => setFeedbackDialogOpen(false)}>
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.section}>
                        <div className={styles.label}>Feedback Type</div>
                        <div className={styles.radioGroup}>
                            {["Bug Report", "Feature Request", "Auth and Billing", "General Feedback"].map((opt) => (
                                <label key={opt} className={styles.radioOption}>
                                    <input
                                        type="radio"
                                        name="feedbackType"
                                        value={opt}
                                        checked={type === opt}
                                        onChange={(e) => setType(e.target.value)}
                                        className={styles.radioInput}
                                    />
                                    <span className={styles.radioLabel}>{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.label}>Description</div>
                        <div className={styles.description}>
                            Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request. Some helpful information includes:
                            <ul className={styles.descriptionList}>
                                <li>Steps to reproduce the issue</li>
                                <li>Expected behavior</li>
                                <li>Actual behavior</li>
                                <li>Any error messages</li>
                                <li>Any relevant information</li>
                            </ul>
                        </div>
                        <div className={styles.textareaContainer}>
                            <textarea
                                className={styles.textarea}
                                placeholder="Describe the bug you encountered..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <div className={`${styles.charCount} ${isFormValid ? styles.valid : ""}`}>
                                {description.length}/50
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.label}>Steps to Reproduce</div>
                        <div className={styles.textareaContainer}>
                            <textarea
                                className={styles.textarea}
                                placeholder="Please list the steps to reproduce the issue"
                                value={steps}
                                onChange={(e) => setSteps(e.target.value)}
                                style={{ minHeight: "80px" }}
                            />
                        </div>
                    </div>

                    <div className={styles.checkboxGroup}>
                        {screenshots.length > 0 && (
                            <div className={styles.previewList}>
                                {screenshots.map((src, i) => (
                                    <div key={i} className={styles.previewContainer}>
                                        <img src={src} alt={`Screenshot ${i + 1}`} className={styles.previewImage} />
                                        <button className={styles.removeScreenshot} onClick={() => removeScreenshot(i)} title="Remove screenshot">
                                            <X size={10} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={styles.actionRow}>
                            <button className={styles.attachAction} onClick={handleTakeScreenshot}>
                                <Paperclip size={16} />
                                <span>Take screenshot</span>
                            </button>
                            <button className={styles.attachAction} onClick={() => fileInputRef.current?.click()}>
                                <Upload size={16} />
                                <span>Upload image</span>
                            </button>
                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple
                                ref={fileInputRef} 
                                style={{ display: "none" }} 
                                onChange={handleFileUpload}
                            />
                        </div>

                        <label className={styles.checkboxOption}>
                            <input
                                type="checkbox"
                                checked={attachLogs}
                                onChange={(e) => setAttachLogs(e.target.checked)}
                                className={styles.checkboxInput}
                            />
                            <span className={styles.checkboxLabel}>Attach WorldWideView diagnostic logs and information</span>
                        </label>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.label}>Email Address</div>
                        <input
                            type="email"
                            className={styles.input}
                            placeholder="name@example.com"
                            value={email}
                            onChange={handleEmailChange}
                        />
                    </div>
                </div>

                <div className={styles.footer}>
                    <button 
                        className={`${styles.submitButton} ${isSubmitting ? styles.submitting : ""} ${isFormValid ? styles.enabled : ""}`} 
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isFormValid}
                    >
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}
