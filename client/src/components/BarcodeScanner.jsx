import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { X, ScanLine, RotateCcw, AlertCircle } from 'lucide-react';

const BarcodeScanner = ({ onScan, onClose }) => {
    const [scanned, setScanned] = useState(false);
    const [error, setError] = useState(null);
    const scannerRef = useRef(null);
    const readerId = "barcode-scanner-reader";

    useEffect(() => {
        let scanner = null;

        const startScanner = () => {
            try {
                const config = {
                    fps: 20,
                    qrbox: (viewWidth, viewHeight) => {
                        const size = Math.min(viewWidth, viewHeight) * 0.75;
                        return { width: size, height: size };
                    },
                    aspectRatio: 1.0,
                    rememberLastUsedCamera: true,
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                };

                scanner = new Html5QrcodeScanner(readerId, config, false);
                scannerRef.current = scanner;

                scanner.render((decodedText) => {
                    if (!scanned) {
                        setScanned(true);
                        scanner.clear().catch(e => console.error("Clear error:", e));
                        onScan(decodedText);
                    }
                }, (err) => {
                    // Ignore errors during scanning
                });
            } catch (err) {
                console.error("Scanner Error:", err);
                setError("Could not start camera. Please ensure permissions are granted.");
            }
        };

        const timer = setTimeout(startScanner, 500);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(e => console.error("Cleanup error:", e));
            }
        };
    }, [onScan, scanned]);

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[1000] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md relative flex flex-col h-full max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                            <ScanLine className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Smart Scan</h2>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mt-1">Focus on packet barcode</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Scanner Viewport */}
                <div className="flex-1 relative bg-slate-900 rounded-[2.5rem] overflow-hidden border-2 border-[#2FC8B9]/30 shadow-[0_0_80px_rgba(47,200,185,0.1)] flex items-center justify-center">
                    <div id={readerId} className="w-full h-full"></div>

                    {error && (
                        <div className="absolute inset-0 bg-slate-900 z-10 flex flex-col items-center justify-center p-8 text-center">
                            <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
                            <p className="text-white font-bold text-sm mb-6 uppercase tracking-wider">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                Refresh App
                            </button>
                        </div>
                    )}

                    {!scanned && !error && (
                        <div className="absolute inset-0 pointer-events-none border-[1.5rem] border-black/20">
                            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#2FC8B9] shadow-[0_0_15px_#2FC8B9] animate-scan-line"></div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 flex flex-col items-center gap-4 shrink-0">
                    <p className="text-slate-400 text-[10px] font-bold text-center uppercase tracking-widest leading-relaxed">
                        Scanning starts automatically when permissions are granted
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-white/5 text-white rounded-xl font-black uppercase text-[10px] tracking-widest border border-white/10 active:scale-95"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { transform: translateY(-100px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(100px); opacity: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 3s ease-in-out infinite;
                }
                #${readerId} {
                    border: none !important;
                }
                #${readerId} video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                    border-radius: 2.5rem !important;
                }
                #${readerId} button {
                    background-color: white !important;
                    color: black !important;
                    border: none !important;
                    padding: 12px 24px !important;
                    border-radius: 12px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase !important;
                    font-size: 11px !important;
                    letter-spacing: 1px !important;
                    margin-top: 20px !important;
                    cursor: pointer !important;
                }
                #${readerId} img {
                    display: none !important;
                }
                #${readerId}__dashboard_section_csr {
                    padding: 20px !important;
                    text-align: center !important;
                }
            `}</style>
        </div>
    );
};

export default BarcodeScanner;
