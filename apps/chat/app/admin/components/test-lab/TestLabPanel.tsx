"use client";

import { useState, useCallback } from "react";
import { useTestLabStream } from "./useTestLabStream";
import type { TestConfig } from "./useTestLabStream";
import TestLabConfigPanel from "./TestLabConfigPanel";
import TestLabChatPanel from "./TestLabChatPanel";

export default function TestLabPanel() {
    const [config, setConfig] = useState<TestConfig>({
        model: "",
        tenantId: "",
        phone: "",
        system: "",
    });
    const [input, setInput] = useState("");

    const { messages, state, sendMessage, reset } = useTestLabStream();

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || state.isStreaming) return;
        setInput("");
        sendMessage(text, config);
    }, [input, state.isStreaming, sendMessage, config]);

    const handleClear = useCallback(() => {
        reset();
        setInput("");
    }, [reset]);

    return (
        <div className="flex h-full w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-pure)]">
            {/* Left – Config (~300px) */}
            <TestLabConfigPanel config={config} onConfigChange={setConfig} onClearChat={handleClear} />

            {/* Center – Chat (flex-1) — now includes inline thinking, tool calls, details & WA rendering */}
            <TestLabChatPanel
                messages={messages}
                isStreaming={state.isStreaming}
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
            />
        </div>
    );
}
