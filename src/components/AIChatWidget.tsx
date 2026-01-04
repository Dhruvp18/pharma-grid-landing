import { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from "@/config";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Bot, Stethoscope } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIChatWidgetProps {
    initialContext?: {
        device_name?: string;
        model?: string;
        category?: string;
    };
    triggerLabel?: string;
    className?: string;
}

export const AIChatWidget = ({ initialContext, triggerLabel, className }: AIChatWidgetProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
        {
            role: 'assistant',
            content: initialContext
                ? `Hi! I see you need help with the **${initialContext.device_name}**. How can I assist you safely?`
                : "Hello! I am your **Pharma-Grid Medical Assistant**. Ask me about general health queries or specific devices."
        }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll context
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Open automatically if context provided
    useEffect(() => {
        if (initialContext) {
            setIsOpen(true);
        }
    }, [initialContext]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput("");
        setIsLoading(true);

        try {
            // Call Backend Endpoint
            const response = await fetch(`${API_BASE_URL}/chat-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMsg,
                    context: initialContext || {}
                }),
            });

            const data = await response.json();

            if (data.response) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again." }]);
            }

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Network error. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Trigger Button - Floating or Inline */}
            {triggerLabel ? (
                <Button onClick={() => setIsOpen(true)} className={className}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {triggerLabel}
                </Button>
            ) : (
                <div className="ai-chat-widget-container fixed bottom-6 right-6 z-[9999]">
                    <Button
                        onClick={() => setIsOpen(!isOpen)}
                        className="rounded-full w-14 h-14 shadow-xl bg-teal-600 hover:bg-teal-700 text-white"
                    >
                        {isOpen ? <X /> : <MessageCircle className="w-8 h-8" />}
                    </Button>
                </div>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className={`ai-chat-widget-container fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[9999] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 font-sans`}>
                    {/* Header */}
                    <div className={`p-4 ${initialContext ? 'bg-primary text-primary-foreground' : 'bg-teal-600 text-white'} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            {initialContext ? <Bot className="w-6 h-6" /> : <Stethoscope className="w-6 h-6" />}
                            <span className="font-bold text-lg">{initialContext ? 'Device Companion' : 'Medical Assistant'}</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                    }`}>
                                    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white px-4 py-2 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="p-3 bg-white border-t flex gap-2">
                        <input
                            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Type your question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                        <Button size="icon" className="rounded-full w-10 h-10 shrink-0" onClick={handleSend} disabled={isLoading || !input.trim()}>
                            <Send className="w-4 h-4 ml-0.5" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};
