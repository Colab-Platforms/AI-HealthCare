"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
}

export default function RadialOrbitalTimeline({
  timelineData,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  );
  const [viewMode, setViewMode] = useState<"orbital">("orbital");
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset, setCenterOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);

        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: NodeJS.Timeout;

    if (autoRotate && viewMode === "orbital") {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => {
          const newAngle = (prev + 0.3) % 360;
          return Number(newAngle.toFixed(3));
        });
      }, 50);
    }

    return () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
      }
    };
  }, [autoRotate, viewMode]);

  const centerViewOnNode = (nodeId: number) => {
    if (viewMode !== "orbital" || !nodeRefs.current[nodeId]) return;

    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;

    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;

    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
    );

    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "text-white bg-black border-white";
      case "in-progress":
        return "text-black bg-white border-black";
      case "pending":
        return "text-white bg-black/40 border-white/50";
      default:
        return "text-white bg-black/40 border-white/50";
    }
  };

  return (
    <div
      className="w-full py-20 md:py-32 bg-gradient-to-b from-transparent via-transparent to-transparent overflow-hidden"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - Hidden on Mobile */}
        <div className="hidden md:block text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span className="text-sm uppercase tracking-wider text-cyan-300 font-medium">Platform Features</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Five Core Features That Power HealthAI
          </h2>
          <p className="text-lg text-cyan-100">
            Discover the essential capabilities that make intelligent health management possible
          </p>
        </div>

        {/* Main Content - Desktop Layout */}
        <div className="hidden lg:flex items-center justify-center gap-16 h-[600px]">
          {/* Left Side - Meaningful Paragraph */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-6xl md:text-7xl font-serif font-bold text-white leading-tight">
              Transform Your Health With Advanced AI Intelligence and Insights
            </p>
          </div>

          {/* Right Side - Timeline Spinner with Ocean Blue Background */}
          <div className="flex-1 h-full relative rounded-3xl overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(10, 61, 92, 0.4) 0%, rgba(13, 90, 138, 0.4) 100%)'}}>
            <div className="absolute inset-0 rounded-3xl border border-cyan-500/30"></div>
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1000px",
            transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
          }}
        >
          <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-500 animate-pulse flex items-center justify-center z-10">
            <div className="absolute w-20 h-20 rounded-full border border-white/20 animate-ping opacity-70"></div>
            <div
              className="absolute w-24 h-24 rounded-full border border-white/10 animate-ping opacity-50"
              style={{ animationDelay: "0.5s" }}
            ></div>
            <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md"></div>
          </div>

          <div className="absolute w-96 h-96 rounded-full border border-white/10"></div>

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            const nodeStyle = {
              transform: `translate(${position.x}px, ${position.y}px)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => (nodeRefs.current[item.id] = el)}
                className="absolute transition-all duration-700 cursor-pointer"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                <div
                  className={`absolute rounded-full -inset-1 ${
                    isPulsing ? "animate-pulse duration-1000" : ""
                  }`}
                  style={{
                    background: `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)`,
                    width: `${item.energy * 0.5 + 40}px`,
                    height: `${item.energy * 0.5 + 40}px`,
                    left: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                    top: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                  }}
                ></div>

                <div
                  className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${
                    isExpanded
                      ? "bg-cyan-400 text-[#0a3d5c]"
                      : isRelated
                      ? "bg-cyan-400/60 text-[#0a3d5c]"
                      : "bg-[#0a3d5c] text-cyan-400"
                  }
                  border-2 
                  ${
                    isExpanded
                      ? "border-cyan-400 shadow-lg shadow-cyan-400/30"
                      : isRelated
                      ? "border-cyan-400 animate-pulse"
                      : "border-cyan-400/60"
                  }
                  transition-all duration-300 transform
                  ${isExpanded ? "scale-150" : ""}
                `}
                >
                  <Icon size={16} />
                </div>

                <div
                  className={`
                  absolute top-12  whitespace-nowrap
                  text-xs font-semibold tracking-wider
                  transition-all duration-300
                  ${isExpanded ? "text-white scale-125" : "text-white/70"}
                `}
                >
                  {item.title}
                </div>

                {isExpanded && (
                  <Card className="absolute top-14 left-1/2 -translate-x-1/2 w-56 bg-gradient-to-br from-[#0a3d5c] to-[#0d5a8a] backdrop-blur-lg border-cyan-500/50 shadow-xl shadow-cyan-500/20 overflow-visible z-50">
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-px h-1.5 bg-cyan-400/70"></div>
                    <CardHeader className="pb-1.5 pt-3 px-3">
                      <div className="flex justify-between items-center mb-0.5">
                        <Badge
                          className={`px-1.5 text-xs font-semibold ${getStatusStyles(
                            item.status
                          )}`}
                        >
                          {item.status === "completed"
                            ? "✓ COMPLETE"
                            : item.status === "in-progress"
                            ? "⚡ IN PROGRESS"
                            : "⏱ PENDING"}
                        </Badge>
                        <span className="text-xs font-mono text-cyan-300/70">
                          {item.date}
                        </span>
                      </div>
                      <CardTitle className="text-xs text-white mt-0.5">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-cyan-100/90 space-y-1.5 px-3 pb-2">
                      <div>
                        <h4 className="text-cyan-300 font-semibold mb-0.5 text-xs">📋 Overview</h4>
                        <p className="text-cyan-100/80 text-xs leading-tight">{item.content}</p>
                      </div>

                      <div className="pt-1.5 border-t border-cyan-500/30">
                        <h4 className="text-cyan-300 font-semibold mb-1 text-xs">✨ Key Features</h4>
                        <div className="space-y-0.5">
                          {item.id === 1 && (
                            <>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Comprehensive health data collection</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>User needs and pain points analysis</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Feature prioritization framework</span>
                              </div>
                            </>
                          )}
                          {item.id === 2 && (
                            <>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Scalable microservices architecture</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>AI/ML pipeline integration</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Secure data storage design</span>
                              </div>
                            </>
                          )}
                          {item.id === 3 && (
                            <>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Claude AI integration for analysis</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Real-time report processing</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Multi-language support</span>
                              </div>
                            </>
                          )}
                          {item.id === 4 && (
                            <>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Automated test suite coverage</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Performance optimization</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Security vulnerability scanning</span>
                              </div>
                            </>
                          )}
                          {item.id === 5 && (
                            <>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>Production deployment pipeline</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>24/7 monitoring and alerts</span>
                              </div>
                              <div className="flex gap-1.5 text-xs">
                                <span className="text-cyan-400 flex-shrink-0">→</span>
                                <span>User onboarding and support</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-cyan-500/30">
                        <div className="flex justify-between items-center text-xs mb-0.5">
                          <span className="flex items-center text-cyan-300">
                            <Zap size={9} className="mr-0.5" />
                            Progress
                          </span>
                          <span className="font-mono text-cyan-400 text-xs">{item.energy}%</span>
                        </div>
                        <div className="w-full h-1 bg-cyan-900/50 rounded-full overflow-hidden border border-cyan-500/30">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                            style={{ width: `${item.energy}%` }}
                          ></div>
                        </div>
                      </div>

                      {item.relatedIds.length > 0 && (
                        <div className="pt-1.5 border-t border-cyan-500/30">
                          <div className="flex items-center mb-0.5">
                            <Link size={9} className="text-cyan-400 mr-0.5" />
                            <h4 className="text-xs uppercase tracking-wider font-semibold text-cyan-300">
                              Related Phases
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find(
                                (i) => i.id === relatedId
                              );
                              return (
                                <Button
                                  key={relatedId}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center h-5 px-1 py-0 text-xs rounded-md border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem(relatedId);
                                  }}
                                >
                                  {relatedItem?.title}
                                  <ArrowRight
                                    size={7}
                                    className="ml-0.5 text-cyan-400/60"
                                  />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
          </div>
        </div>

        {/* Mobile Layout - Only Spinner */}
        <div className="lg:hidden h-auto py-12 flex flex-col items-center justify-center">
          <div className="relative w-full h-[600px] flex items-center justify-center rounded-3xl overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(10, 61, 92, 0.4) 0%, rgba(13, 90, 138, 0.4) 100%)'}}>
            <div className="absolute inset-0 rounded-3xl border border-cyan-500/30"></div>
            <div
              className="absolute w-full h-full flex items-center justify-center"
              ref={orbitRef}
              style={{
                perspective: "1000px",
                transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
              }}
            >
              <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-500 animate-pulse flex items-center justify-center z-10">
                <div className="absolute w-20 h-20 rounded-full border border-white/20 animate-ping opacity-70"></div>
                <div
                  className="absolute w-24 h-24 rounded-full border border-white/10 animate-ping opacity-50"
                  style={{ animationDelay: "0.5s" }}
                ></div>
                <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md"></div>
              </div>

              <div className="absolute w-96 h-96 rounded-full border border-white/10"></div>

              {timelineData.map((item, index) => {
                const position = calculateNodePosition(index, timelineData.length);
                const isExpanded = expandedItems[item.id];
                const isRelated = isRelatedToActive(item.id);
                const isPulsing = pulseEffect[item.id];
                const Icon = item.icon;

                const nodeStyle = {
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isExpanded ? 200 : position.zIndex,
                  opacity: isExpanded ? 1 : position.opacity,
                };

                return (
                  <div
                    key={item.id}
                    ref={(el) => (nodeRefs.current[item.id] = el)}
                    className="absolute transition-all duration-700 cursor-pointer"
                    style={nodeStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItem(item.id);
                    }}
                  >
                    <div
                      className={`absolute rounded-full -inset-1 ${
                        isPulsing ? "animate-pulse duration-1000" : ""
                      }`}
                      style={{
                        background: `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)`,
                        width: `${item.energy * 0.5 + 40}px`,
                        height: `${item.energy * 0.5 + 40}px`,
                        left: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                        top: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                      }}
                    ></div>

                    <div
                      className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${
                        isExpanded
                          ? "bg-cyan-400 text-[#0a3d5c]"
                          : isRelated
                          ? "bg-cyan-400/60 text-[#0a3d5c]"
                          : "bg-[#0a3d5c] text-cyan-400"
                      }
                      border-2 
                      ${
                        isExpanded
                          ? "border-cyan-400 shadow-lg shadow-cyan-400/30"
                          : isRelated
                          ? "border-cyan-400 animate-pulse"
                          : "border-cyan-400/60"
                      }
                      transition-all duration-300 transform
                      ${isExpanded ? "scale-150" : ""}
                    `}
                    >
                      <Icon size={16} />
                    </div>

                    <div
                      className={`
                      absolute top-12  whitespace-nowrap
                      text-xs font-semibold tracking-wider
                      transition-all duration-300
                      ${isExpanded ? "text-white scale-125" : "text-white/70"}
                    `}
                    >
                      {item.title}
                    </div>

                    {isExpanded && (
                      <Card className="absolute top-14 left-1/2 -translate-x-1/2 w-56 bg-gradient-to-br from-[#0a3d5c] to-[#0d5a8a] backdrop-blur-lg border-cyan-500/50 shadow-xl shadow-cyan-500/20 overflow-visible z-50">
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-px h-1.5 bg-cyan-400/70"></div>
                        <CardHeader className="pb-1.5 pt-3 px-3">
                          <div className="flex justify-between items-center mb-0.5">
                            <Badge
                              className={`px-1.5 text-xs font-semibold ${getStatusStyles(
                                item.status
                              )}`}
                            >
                              {item.status === "completed"
                                ? "✓ COMPLETE"
                                : item.status === "in-progress"
                                ? "⚡ IN PROGRESS"
                                : "⏱ PENDING"}
                            </Badge>
                            <span className="text-xs font-mono text-cyan-300/70">
                              {item.date}
                            </span>
                          </div>
                          <CardTitle className="text-xs text-white mt-0.5">
                            {item.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-cyan-100/90 space-y-1.5 px-3 pb-2">
                          <div>
                            <h4 className="text-cyan-300 font-semibold mb-0.5 text-xs">📋 Overview</h4>
                            <p className="text-cyan-100/80 text-xs leading-tight">{item.content}</p>
                          </div>

                          <div className="pt-1.5 border-t border-cyan-500/30">
                            <h4 className="text-cyan-300 font-semibold mb-1 text-xs">✨ Key Features</h4>
                            <div className="space-y-0.5">
                              {item.id === 1 && (
                                <>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Comprehensive health data collection</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>User needs and pain points analysis</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Feature prioritization framework</span>
                                  </div>
                                </>
                              )}
                              {item.id === 2 && (
                                <>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Scalable microservices architecture</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>AI/ML pipeline integration</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Secure data storage design</span>
                                  </div>
                                </>
                              )}
                              {item.id === 3 && (
                                <>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Claude AI integration for analysis</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Real-time report processing</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Multi-language support</span>
                                  </div>
                                </>
                              )}
                              {item.id === 4 && (
                                <>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Automated test suite coverage</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Performance optimization</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Security vulnerability scanning</span>
                                  </div>
                                </>
                              )}
                              {item.id === 5 && (
                                <>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>Production deployment pipeline</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>24/7 monitoring and alerts</span>
                                  </div>
                                  <div className="flex gap-1.5 text-xs">
                                    <span className="text-cyan-400 flex-shrink-0">→</span>
                                    <span>User onboarding and support</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-cyan-500/30">
                            <div className="flex justify-between items-center text-xs mb-0.5">
                              <span className="flex items-center text-cyan-300">
                                <Zap size={9} className="mr-0.5" />
                                Progress
                              </span>
                              <span className="font-mono text-cyan-400 text-xs">{item.energy}%</span>
                            </div>
                            <div className="w-full h-1 bg-cyan-900/50 rounded-full overflow-hidden border border-cyan-500/30">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
                                style={{ width: `${item.energy}%` }}
                              ></div>
                            </div>
                          </div>

                          {item.relatedIds.length > 0 && (
                            <div className="pt-1.5 border-t border-cyan-500/30">
                              <div className="flex items-center mb-0.5">
                                <Link size={9} className="text-cyan-400 mr-0.5" />
                                <h4 className="text-xs uppercase tracking-wider font-semibold text-cyan-300">
                                  Related Phases
                                </h4>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.relatedIds.map((relatedId) => {
                                  const relatedItem = timelineData.find(
                                    (i) => i.id === relatedId
                                  );
                                  return (
                                    <Button
                                      key={relatedId}
                                      variant="outline"
                                      size="sm"
                                      className="flex items-center h-5 px-1 py-0 text-xs rounded-md border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 transition-all"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleItem(relatedId);
                                      }}
                                    >
                                      {relatedItem?.title}
                                      <ArrowRight
                                        size={7}
                                        className="ml-0.5 text-cyan-400/60"
                                      />
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
