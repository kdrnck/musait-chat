"use client";

import { useState, useCallback } from "react";
import { useTestLabStream } from "./useTestLabStream";
import type { TestConfig } from "./useTestLabStream";
import TestLabConfigPanel from "./TestLabConfigPanel";
import TestLabChatPanel from "./TestLabChatPanel";
import TestLabDebugPanel from "./TestLabDebugPanel";

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

            {/* Center – Chat (flex-1) */}
            <TestLabChatPanel
                messages={messages}
                isStreaming={state.isStreaming}
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
            />

            {/* Right – Debug (~380px) */}
            <TestLabDebugPanel streamState={state} />
        </div>
    );
}
