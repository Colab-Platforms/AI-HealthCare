import React from 'react';
import { Brain, Moon, Activity, Zap, ScanLine, Sparkles, BarChart3, Clock, Droplets, HeartPulse, Wind } from 'lucide-react';

/* ─── Figma dimensions (design canvas = 1443 × 1324, gap = 48) ───
   AI Analyzer   495 × 865   │  Nutrition    900 × 397
                              │  Movement 425×411 │ Sleep 425×411
   Diabetes Care 963 × 411   │  My Health    430 × 411
─────────────────────────────────────────────────────────────── */

const AIAnalyzerCard = () => (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(180deg, #C1B1E4 0%, #D7C8F9 100%)', overflow: 'hidden', borderRadius: 32 }}>
        {/* Title */}
        <div style={{ width: 210, left: 37, top: 35, position: 'absolute', color: 'rgba(103, 0, 137, 0.30)', fontSize: 50, fontFamily: 'Urbanist', fontStyle: 'italic', fontWeight: 700, lineHeight: '60px', wordWrap: 'break-word' }}>AI<br />Analyzer</div>

        {/* Decorative ellipses top-right */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <div key={`arc-${i}`} style={{ width: 318 - i * 30, height: 246 - i * 23.1, left: 668 - i * 28.5, top: -25 + i * 0.6, position: 'absolute', transform: 'rotate(117deg)', transformOrigin: 'top left', borderRadius: 9999, border: '1px #6D6DCC solid' }} />
        ))}

        {/* Chart Box */}
        <div style={{ width: 336, height: 157, left: 37, top: 221, position: 'absolute', background: 'rgba(255,255,255,0.57)', overflow: 'hidden', borderRadius: 10, backdropFilter: 'blur(2px)' }}>
            {/* Horizontal grid lines */}
            {[24, 46, 68, 90, 112].map(t => (
                <div key={`h-${t}`} style={{ width: 283, height: 0.8, left: 36, top: t, position: 'absolute', outline: '1px #B0B0B0 solid', outlineOffset: '-0.5px' }} />
            ))}
            {/* Vertical grid lines */}
            {[49, 94, 139, 183, 229, 273, 318].map(l => (
                <div key={`v-${l}`} style={{ width: 0.3, height: 99, left: l, top: 25, position: 'absolute', outline: '1px #B0B0B0 solid', outlineOffset: '-0.5px' }} />
            ))}
            {/* Y-axis labels */}
            {[{ t: 22, v: '1 000' }, { t: 44, v: '500' }, { t: 66, v: '0' }, { t: 88, v: '-500' }, { t: 111, v: '-1 000' }].map(l => (
                <div key={l.v} style={{ left: 25, top: l.t, position: 'absolute', textAlign: 'center', color: '#474747', fontSize: 12, fontFamily: 'Roboto', fontWeight: 400 }}>{l.v}</div>
            ))}
            {/* X-axis month labels */}
            {[{ l: 51, m: 'January' }, { l: 91, m: 'Ferbuary' }, { l: 134, m: 'March' }, { l: 177, m: 'April' }, { l: 217, m: 'May' }, { l: 257, m: 'June' }, { l: 299, m: 'July' }].map(item => (
                <div key={item.m} style={{ left: item.l, top: 131, position: 'absolute', transform: 'rotate(-23deg)', transformOrigin: 'top left', textAlign: 'center', color: '#474747', fontSize: 12, fontFamily: 'Roboto', fontWeight: 400 }}>{item.m}</div>
            ))}
            {/* Data points */}
            {[
                { x: 46, y: 53, c: 'rgba(251,227,142,0.7)' }, { x: 46, y: 83, c: 'rgba(251,227,142,0.7)' },
                { x: 90, y: 49, c: '#D7CAB4' }, { x: 90, y: 88, c: '#D7CAB4' },
                { x: 135, y: 73, c: '#B2B2D8' }, { x: 135, y: 92, c: '#B2B2D8' },
                { x: 181, y: 38, c: '#919BF9' }, { x: 180, y: 103, c: '#919BF9' },
                { x: 225, y: 28, c: '#B5B4D5' }, { x: 225, y: 87, c: '#B5B4D5' },
                { x: 270, y: 52, c: '#D8CBB2' }, { x: 270, y: 80, c: '#D8CBB2' },
                { x: 314, y: 31, c: 'rgba(251,227,142,0.7)' }, { x: 314, y: 64, c: 'rgba(251,227,142,0.7)' },
            ].map((d, i) => (
                <div key={i} style={{ width: 7, height: 6, left: d.x, top: d.y, position: 'absolute', borderRadius: 9999, border: `3px ${d.c} solid` }} />
            ))}
            {/* Yellow range boxes */}
            <div style={{ width: 270, height: 64, left: 49, top: 31, position: 'absolute', outline: '4px #FBE38E solid', outlineOffset: '-2px' }} />
            <div style={{ width: 269, height: 56, left: 49, top: 51, position: 'absolute', outline: '4px #FBE38E solid', outlineOffset: '-2px' }} />
        </div>

        {/* Robot image bottom-left */}
        <div style={{ width: 104, height: 119, left: 24, top: 729, position: 'absolute', borderRadius: 4, overflow: 'hidden' }}>
            <img style={{ width: 84, height: 106, left: 10, top: 7, position: 'absolute', objectFit: 'contain' }} src="/assets/landing/robot.png" alt="" />
        </div>

        {/* Small meal image */}
        <div style={{ width: 143, height: 93, left: 33, top: 414, position: 'absolute', borderRadius: 10, overflow: 'hidden' }}>
            <img style={{ width: 125, height: 70, left: 9, top: 11, position: 'absolute', borderRadius: 10, objectFit: 'cover' }} src="/assets/landing/meal.png" alt="" />
        </div>

        {/* Lifestyle changes tag */}
        <div style={{ width: 159, height: 97, left: 240, top: 441, position: 'absolute', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ width: 143, left: 8, top: 6, position: 'absolute', borderRadius: 10 }}>
                <div style={{ height: 84, background: '#FBE38E', overflow: 'hidden', padding: '17px 15px' }}>
                    <div style={{ color: 'black', fontSize: 12, fontFamily: 'Roboto', fontWeight: 600 }}>Lifestyle changes</div>
                    <div style={{ color: 'black', fontSize: 12, fontFamily: 'Roboto', fontWeight: 400, marginTop: 4 }}>Cardiology follow-up</div>
                    <div style={{ color: 'black', fontSize: 12, fontFamily: 'Roboto', fontWeight: 400 }}>Stress test scheduled</div>
                </div>
            </div>
        </div>

        {/* Robot at bottom-right */}
        <img style={{ width: 207, height: 271, left: 297, top: 594, position: 'absolute', objectFit: 'contain' }} src="/assets/landing/robot.png" alt="" />
    </div>
);

const NutritionCard = () => (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(2deg, #F383A3 0%, #FACCD9 100%)', overflow: 'hidden', borderRadius: 32 }}>
        {/* Title */}
        <div style={{ right: 22, top: 22, position: 'absolute', textAlign: 'center', color: '#FF6AB2', fontSize: 50, fontFamily: 'Urbanist', fontStyle: 'italic', fontWeight: 700, lineHeight: '75px' }}>Nutrition</div>

        {/* Feature descriptions - positioned in left column */}
        <div style={{ position: 'absolute', left: 30, top: 30, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
                { title: 'Smart Recipe Suggestion', desc: 'Adapt to your nutrition intake, health goals, and daily activity to recommend the right meals at the right time.', color: '#8675B9' },
                { title: 'Snap to track nutrition', desc: 'Snap your food to instantly track calories, macros, and nutrition insights powered by AI.', color: '#BFA031' },
                { title: 'AI powered nutrient insights', desc: 'Analyze your intake and deliver personalized, actionable health recommendations in real time.', color: '#3A9735' },
                { title: 'Proactive health nudges', desc: 'Intelligently guide you with timely reminders and personalized suggestions to improve sleep, nutrition, and activity.', color: '#C92D2D' },
            ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 16, height: 16, flexShrink: 0, overflow: 'hidden' }}>
                        <div style={{ width: 15, height: 13, background: item.color, borderRadius: 2 }} />
                    </div>
                    <div style={{ maxWidth: 104 }}>
                        <div style={{ color: 'black', fontSize: 10, fontFamily: 'Montserrat', fontWeight: 500 }}>{item.title}</div>
                        <div style={{ color: 'black', fontSize: 8, fontFamily: 'Montserrat', fontWeight: 400, marginTop: 2 }}>{item.desc}</div>
                    </div>
                </div>
            ))}
        </div>

        {/* Calorie circle */}
        <div style={{ position: 'absolute', left: 30, bottom: 40 }}>
            <div style={{ width: 142, height: 142, borderRadius: 9999, border: '5px solid white', position: 'absolute', left: -16, top: -26 }} />
            <div style={{ width: 90, height: 90, background: 'white', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '10px solid rgba(255,255,255,0.5)' }}>
                <span style={{ fontSize: 26, fontWeight: 400, lineHeight: '26px', color: 'black' }}>1345</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'black', textAlign: 'center' }}>Calories</span>
            </div>
        </div>

        {/* Nutrient pills - right side */}
        <div style={{ position: 'absolute', right: 30, top: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
                { name: 'Vitamin C', val: '13.1', c: '#8F92D5' },
                { name: 'Iron Fe', val: '17.3', c: '#DEC89E' },
                { name: 'Calcium', val: '12.2', c: '#F6A474' },
            ].map(item => (
                <div key={item.name} style={{ width: 191, height: 30, position: 'relative', borderRadius: 4 }}>
                    <div style={{ width: 30, height: 30, left: 0, top: 0, position: 'absolute', background: item.c, borderRadius: 9999 }} />
                    <div style={{ left: 10, top: 6, position: 'absolute', textAlign: 'center', color: 'black', fontSize: 14, fontFamily: 'Montserrat', fontWeight: 500 }}>C</div>
                    <div style={{ left: 61, top: 0, position: 'absolute', textAlign: 'center', color: 'black', fontSize: 14, fontFamily: 'Montserrat', fontWeight: 500 }}>{item.name}</div>
                    <div style={{ left: 87, top: 17, position: 'absolute', textAlign: 'center', color: '#464646', fontSize: 10, fontFamily: 'Montserrat', fontWeight: 500 }}>{item.val}</div>
                    <div style={{ width: 29, height: 30, left: 162, top: 0, position: 'absolute', background: 'white', borderRadius: 5 }} />
                </div>
            ))}
        </div>

        {/* Calendar Week Row */}
        <div style={{ position: 'absolute', right: 30, bottom: 100, display: 'flex', alignItems: 'center', gap: 18 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ position: 'relative' }}>
                    {d === 'W' && i === 3 && <div style={{ width: 27, height: 27, background: '#F47551', borderRadius: 9999, position: 'absolute', left: -5, top: -1 }} />}
                    <span style={{ color: d === 'W' && i === 3 ? 'white' : 'rgba(0,0,0,0.7)', fontSize: 16, fontFamily: 'Kurale', fontWeight: 400, lineHeight: '29px', position: 'relative', zIndex: 1 }}>{d}</span>
                </div>
            ))}
        </div>

        {/* Food image area */}
        <div style={{ position: 'absolute', right: 30, bottom: 20, width: 184, height: 200, background: 'white', borderRadius: 10, overflow: 'hidden' }}>
            <img src="/assets/landing/meal.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(18,18,18,0.2)', borderRadius: 59, padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(4px)' }}>
                <ScanLine style={{ width: 20, height: 20, color: '#CDCDCD' }} />
                <span style={{ color: '#CDCDCD', fontSize: 12, fontFamily: 'Poppins', fontWeight: 400, whiteSpace: 'nowrap' }}>Scan Your Meal</span>
            </div>
        </div>

        {/* Macros overlay */}
        <div style={{ position: 'absolute', right: 240, top: 80, color: 'white', fontSize: 10, fontFamily: 'Poppins', fontWeight: 500, lineHeight: '27px' }}>
            <div>Fat <span style={{ marginLeft: 20 }}>40g</span></div>
            <div>Carbs <span style={{ marginLeft: 10 }}>20g</span></div>
            <div>Protein <span style={{ marginLeft: 4 }}>4g</span></div>
        </div>
    </div>
);

const MovementCard = () => (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(180deg, rgba(196,213,140,0.40) 49%, rgba(212,226,164,0.30) 100%)', overflow: 'hidden', borderRadius: 32 }}>
        <img style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, opacity: 0.5 }} src="/assets/landing/movement.png" alt="" />
        {/* Title */}
        <div style={{ left: 23, top: 317, position: 'absolute', textAlign: 'center', color: '#5FBA1E', fontSize: 50, fontFamily: 'Urbanist', fontStyle: 'italic', fontWeight: 700, lineHeight: '75px' }}>Movement</div>
        {/* Step circles */}
        <div style={{ width: 84, height: 83, left: 13, top: 111, position: 'absolute', background: 'white', borderRadius: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Activity style={{ width: 22, height: 22, color: 'white' }} />
            <span style={{ textAlign: 'center', color: 'white', fontSize: 16, fontFamily: 'Urbanist', fontWeight: 600, lineHeight: '19px' }}>2h 3m</span>
        </div>
        <div style={{ width: 51, height: 0, left: 103, top: 165, position: 'absolute', outline: '1px white solid', outlineOffset: '-0.5px' }} />
        <div style={{ width: 84, height: 83, left: 13, top: 211, position: 'absolute', background: 'white', borderRadius: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ textAlign: 'center', color: 'white', fontSize: 16, fontFamily: 'Urbanist', fontWeight: 600, lineHeight: '19px' }}>6000</span>
            <span style={{ textAlign: 'center', color: 'white', fontSize: 10, fontFamily: 'Urbanist', fontWeight: 500, lineHeight: '14px' }}>Steps</span>
        </div>
        <div style={{ width: 68, height: 0, left: 99, top: 253, position: 'absolute', outline: '1px white solid', outlineOffset: '-0.5px' }} />
    </div>
);

const SleepCard = () => (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(180deg, #8E99FB 0%, #D4D9FF 100%)', overflow: 'hidden', borderRadius: 32 }}>
        {/* Title */}
        <div style={{ left: 37, top: 313, position: 'absolute', textAlign: 'center', color: '#8E99FB', fontSize: 50, fontFamily: 'Urbanist', fontStyle: 'italic', fontWeight: 700, lineHeight: '75px' }}>Sleep</div>
        {/* Sleep stats bar */}
        <div style={{ width: 397, height: 58, left: 17, top: 40, position: 'absolute', background: 'linear-gradient(90deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.40) 100%)', overflow: 'hidden', borderRadius: 50, backdropFilter: 'blur(25px)', display: 'flex', alignItems: 'center', padding: '0 17px' }}>
            <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', width: '100%' }}>
                {[
                    { label: 'Duration', value: '8h 9m' },
                    { label: 'Deep Sleep', value: '2h 08m' },
                    { label: 'HRV', value: '68 ms' },
                    { label: 'SpO₂', value: '97% Avg' },
                ].map(item => (
                    <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ color: 'white', fontSize: 8.4, fontFamily: 'Urbanist', fontWeight: 800, lineHeight: '10px' }}>{item.label}</span>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 4 }}>
                            <Moon style={{ width: 12, height: 12, color: '#6D6DCC' }} />
                            <span style={{ textAlign: 'center', color: '#6D6DCC', fontSize: 16.8, fontFamily: 'Urbanist', fontWeight: 500, lineHeight: '24px' }}>{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        {/* AI Analysis box */}
        <div style={{ width: 189, height: 122, left: 27, top: 191, position: 'absolute', background: 'linear-gradient(123deg, rgba(109,109,204,0.48) 0%, rgba(255,255,255,0.07) 100%)', boxShadow: '0px 0.42px 10.47px rgba(69,42,124,0.10)', overflow: 'hidden', borderRadius: 14, border: '1.05px solid white', backdropFilter: 'blur(12.25px)', padding: 15 }}>
            <div style={{ color: 'white', fontSize: 14, fontFamily: 'Montserrat', fontWeight: 700, lineHeight: '18px', letterSpacing: 0.09, marginBottom: 4 }}>AI Analysis</div>
            <div style={{ color: 'white', fontSize: 10, fontFamily: 'Montserrat', fontWeight: 500, lineHeight: '14px', maxWidth: 157 }}>REM sleep ↑12% vs last week - cognitive recovery improved. Keep your current bedtime routine.</div>
        </div>
        {/* Sleep illustration */}
        <div style={{ width: 250, height: 250, left: 244, top: 198, position: 'absolute', borderRadius: 9999, border: '2px solid white' }} />
        <img style={{ width: 217, height: 217, left: 261, top: 209, position: 'absolute', borderRadius: 9999, objectFit: 'cover' }} src="/assets/landing/sleep.png" alt="" />
    </div>
);

const DiabetesCareCard = () => (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(92deg, #F6A474 0%, #F4D0BA 100%)', overflow: 'hidden', borderRadius: 32 }}>
        {/* Grid pattern */}
        {Array.from({ length: 6 }).map((_, col) => Array.from({ length: 5 }).map((_, row) => (
            <div key={`g-${col}-${row}`} style={{ width: 80.33, height: 83.69, left: -30.33 + col * 80.33, top: -10 + row * 83.69, position: 'absolute', border: '1px rgba(255,255,255,0.20) solid' }} />
        )))}

        {/* Title */}
        <div style={{ left: 23, top: 324, position: 'absolute', textAlign: 'center', color: 'rgba(136,63,20,0.60)', fontSize: 50, fontFamily: 'Urbanist', fontStyle: 'italic', fontWeight: 700, lineHeight: '75px' }}>Diabetes Care</div>

        {/* Blood Glucose card */}
        <div style={{ width: 173, height: 193, left: 12, top: 23, position: 'absolute', background: 'rgba(255,255,255,0.60)', boxShadow: '4.2px 6.9px 29.3px rgba(0,0,0,0.08)', borderRadius: 6, backdropFilter: 'blur(4.5px)', padding: 18 }}>
            <div style={{ color: '#1F1F1E', fontSize: 6, fontFamily: 'Poppins', fontWeight: 500 }}>Blood Glucose</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <div>
                    <div style={{ color: '#1F1E1F', fontSize: 15.3, fontFamily: 'Poppins', fontWeight: 500, lineHeight: '20px' }}>136</div>
                    <div style={{ color: '#888', fontSize: 6.6, fontFamily: 'Poppins', fontWeight: 400 }}>mg/dl</div>
                </div>
                <img style={{ width: 74, height: 74, objectFit: 'contain' }} src="/assets/landing/diabetes.png" alt="" />
            </div>
            <div style={{ color: '#888', fontSize: 4.8, fontFamily: 'Poppins', fontWeight: 400, marginTop: 'auto', position: 'absolute', bottom: 10, left: 30 }}>After fasting</div>
        </div>

        {/* Heart card */}
        <div style={{ width: 173, height: 98, left: 12, top: 225, position: 'absolute', background: 'rgba(255,255,255,0.60)', boxShadow: '4.2px 6.9px 13.3px rgba(0,0,0,0.08)', borderRadius: 6, backdropFilter: 'blur(4.5px)', padding: 18 }}>
            <div style={{ color: '#1F1F1E', fontSize: 6, fontFamily: 'Poppins', fontWeight: 500 }}>Heart</div>
            <div style={{ color: '#1F1E1F', fontSize: 15.3, fontFamily: 'Poppins', fontWeight: 500, lineHeight: '20px', marginTop: 8 }}>72</div>
            <div style={{ color: '#9E9E9E', fontSize: 5.4, fontFamily: 'Poppins', fontWeight: 400 }}>bpm</div>
        </div>

        {/* Action pills */}
        <div style={{ position: 'absolute', left: 127, top: 104, display: 'flex', flexDirection: 'column', gap: 30 }}>
            {[
                { text: 'To induce vomiting', top: 0 },
                { text: 'To lower their blood sugar levels', top: 63 },
                { text: 'To raise their blood sugar levels', top: 137 },
            ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', borderRadius: 5, overflow: 'hidden' }}>
                    <img style={{ width: 33, height: 33, borderRadius: 28, objectFit: 'cover' }} src="/assets/landing/diabetes.png" alt="" />
                    <span style={{ color: 'black', fontSize: 8.4, fontFamily: 'Inter', fontWeight: 600 }}>{item.text}</span>
                </div>
            ))}
        </div>

        {/* Test Summary panel */}
        <div style={{ width: 214, padding: 7.5, left: 348, top: 180, position: 'absolute', background: 'rgba(255,255,255,0.19)', overflow: 'hidden', borderRadius: 12.5, backdropFilter: 'blur(2.5px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7.5, marginBottom: 17 }}>
                <BarChart3 style={{ width: 36, height: 37 }} />
                <span style={{ color: 'black', fontSize: 15, fontFamily: 'Montserrat', fontWeight: 500 }}>Total test summary</span>
            </div>
            <div style={{ display: 'flex', gap: 17, marginBottom: 17 }}>
                <div><span style={{ color: 'black', fontSize: 15, fontFamily: 'Montserrat', fontWeight: 500, display: 'block' }}>420</span><span style={{ color: '#595959', fontSize: 10, fontFamily: 'Montserrat' }}>Total Test</span></div>
                <div><span style={{ color: 'black', fontSize: 15, fontFamily: 'Montserrat', fontWeight: 500, display: 'block' }}>20-50</span><span style={{ color: '#595959', fontSize: 10, fontFamily: 'Montserrat' }}>Age Range</span></div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                {[
                    { pct: '60%', label: 'Normal\nTest', grad: 'linear-gradient(180deg, #F7C5A7 0%, #AC9FEF 59%)' },
                    { pct: '40%', label: 'A Level', grad: 'linear-gradient(180deg, #F7C5A8 52%, #A1EDFE 98%)' },
                    { pct: '50%', label: 'B Level', grad: 'linear-gradient(180deg, #F7C5A8 15%, #4CA7FD 100%)' },
                    { pct: '60%', label: 'C Level', grad: 'linear-gradient(180deg, #F7C5A8 0%, #C3E1C8 59%)' },
                ].map((bar, i) => (
                    <div key={i} style={{ width: 44.9, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ color: 'black', fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 600, textAlign: 'center' }}>{bar.pct}</span>
                        <span style={{ color: '#424242', fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 500, textAlign: 'center', whiteSpace: 'pre-line' }}>{bar.label}</span>
                        <div style={{ width: 44.9, height: 99.7, background: bar.grad, borderRadius: 7.5, marginTop: 4 }} />
                    </div>
                ))}
            </div>
        </div>

        {/* Right image */}
        <img style={{ width: 391, height: 410, right: 0, top: 0.5, position: 'absolute', borderTopRightRadius: 30, borderBottomRightRadius: 30, objectFit: 'cover' }} src="/assets/landing/diabetes.png" alt="" />
    </div>
);

const MyHealthCard = () => (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(180deg, rgba(255,212,59,0.85) 0%, #FFF5D1 100%)', overflow: 'hidden', borderRadius: 32 }}>
        {/* Title */}
        <div style={{ left: 35, top: 7, position: 'absolute', textAlign: 'center', color: '#FFFBFB', fontSize: 34, fontFamily: 'Montserrat', fontWeight: 600, zIndex: 2 }}>AI Personalised Plan</div>
        {/* Supplement image */}
        <img style={{ width: 183, height: 166, left: 123, top: 22, position: 'absolute', objectFit: 'contain', zIndex: 1 }} src="/assets/landing/supplements.png" alt="" />

        {/* Immune & Bone pill */}
        <div style={{ width: 177, left: 126, top: 161, position: 'absolute', borderRadius: 60, zIndex: 2 }}>
            <div style={{ height: 51, background: 'rgba(255,255,255,0.31)', overflow: 'hidden', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                <div style={{ width: 33, height: 34, background: '#EEE0AC', borderRadius: 5.4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles style={{ width: 20, height: 20, color: 'rgba(0,0,0,0.5)' }} />
                </div>
                <div>
                    <div style={{ color: 'black', fontSize: 12.9, fontFamily: 'Montserrat', fontWeight: 600 }}>Immune & Bone</div>
                    <div style={{ color: 'black', fontSize: 10.7, fontFamily: 'Montserrat', fontWeight: 400 }}>(based on vitals)</div>
                </div>
            </div>
        </div>

        {/* Cognitive Support pill */}
        <div style={{ width: 188, left: 121, top: 220, position: 'absolute', background: 'rgba(255,255,255,0.31)', borderRadius: 64, zIndex: 2 }}>
            <div style={{ height: 55, overflow: 'hidden', borderRadius: 10.6, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                <div style={{ width: 35, height: 36, background: '#F9DBD1', borderRadius: 5.7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles style={{ width: 20, height: 20, color: 'rgba(0,0,0,0.5)' }} />
                </div>
                <div>
                    <div style={{ color: 'black', fontSize: 13.7, fontFamily: 'Montserrat', fontWeight: 600 }}>Cognitive Support</div>
                    <div style={{ color: 'black', fontSize: 11.4, fontFamily: 'Montserrat', fontWeight: 400 }}>(based on mental load)</div>
                </div>
            </div>
        </div>

        {/* Muscle & Sleep pill */}
        <div style={{ width: 200, left: 115, top: 282, position: 'absolute', background: 'rgba(255,255,255,0.31)', borderRadius: 60, zIndex: 2 }}>
            <div style={{ height: 51, overflow: 'hidden', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                <div style={{ width: 31, height: 32, background: '#D8DCFA', borderRadius: 5.4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles style={{ width: 20, height: 20, color: 'rgba(0,0,0,0.5)' }} />
                </div>
                <div>
                    <div style={{ color: 'black', fontSize: 12.9, fontFamily: 'Montserrat', fontWeight: 600 }}>Muscle & Sleep</div>
                    <div style={{ color: 'black', fontSize: 10.7, fontFamily: 'Montserrat', fontWeight: 400 }}>(based on movement Data)</div>
                </div>
            </div>
        </div>

        {/* My Health title */}
        <div style={{ left: 98, top: 334, position: 'absolute', textAlign: 'center', color: '#FFBE98', fontSize: 50, fontFamily: 'Urbanist', fontStyle: 'italic', fontWeight: 700, lineHeight: '60px', zIndex: 2 }}>My Health</div>

        {/* Decorative blobs */}
        <div style={{ width: 244, height: 242, right: -100, bottom: -100, position: 'absolute', background: 'rgba(254,219,99,0.55)', filter: 'blur(12px)' }} />
        <div style={{ width: 130, height: 130, left: -42, top: 309, position: 'absolute', background: 'rgba(220,217,88,0.60)', borderRadius: 9999, filter: 'blur(14.5px)' }} />
        <div style={{ width: 115, height: 111, left: -49, top: 333, position: 'absolute', background: 'rgba(83,179,177,0.90)', filter: 'blur(8.5px)' }} />
    </div>
);

const InteractiveGridFeatures = () => {
    return (
        <section style={{ background: '#000', padding: '60px 0', overflow: 'hidden' }}>
            {/* Responsive container that scales to fit viewport */}
            <div style={{ maxWidth: 1443, margin: '0 auto', padding: '0 20px' }}>
                {/* CSS Grid matching Figma layout: 1443 x 1324 */}
                <div style={{ display: 'grid', gridTemplateColumns: '495fr 900fr', gridTemplateRows: '397px 411px 411px', gap: 48, width: '100%' }}
                    className="grid-features-layout"
                >
                    {/* AI Analyzer - spans row 1+2, col 1 */}
                    <div className="card-ai-analyzer" style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }}>
                        <div className="card-scale-wrapper card-scale-ai">
                            <AIAnalyzerCard />
                        </div>
                    </div>
                    {/* Nutrition - row 1, col 2 */}
                    <div className="card-nutrition" style={{ gridRow: '1 / 2', gridColumn: '2 / 3' }}>
                        <div className="card-scale-wrapper card-scale-nutrition">
                            <NutritionCard />
                        </div>
                    </div>
                    {/* Movement + Sleep - row 2, col 2, split 50/50 */}
                    <div className="card-movement-sleep" style={{ gridRow: '2 / 3', gridColumn: '2 / 3', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
                        <MovementCard />
                        <SleepCard />
                    </div>
                    {/* Bottom row - Diabetes Care (963) + My Health (430) */}
                    <div className="card-bottom-row" style={{ gridRow: '3 / 4', gridColumn: '1 / 3', display: 'grid', gridTemplateColumns: '963fr 430fr', gap: 48 }}>
                        <div className="card-scale-wrapper card-scale-diabetes">
                            <DiabetesCareCard />
                        </div>
                        <MyHealthCard />
                    </div>
                </div>
            </div>

            {/* Responsive styles */}
            <style>{`
                /* Desktop: scale wrappers are transparent */
                .card-scale-wrapper {
                    width: 100%;
                    height: 100%;
                }

                @media (max-width: 1024px) {
                    .grid-features-layout {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 20px !important;
                    }

                    /* AI Analyzer: Figma 495x865 - scale to fit mobile width */
                    .card-ai-analyzer {
                        width: 100% !important;
                        overflow: hidden;
                        border-radius: 32px;
                    }
                    .card-scale-ai {
                        width: 495px;
                        height: 865px;
                        transform-origin: top left;
                        transform: scale(calc(min(100vw - 40px, 495px) / 495));
                    }

                    /* Nutrition: Figma 900x397 - scale to fit mobile width */
                    .card-nutrition {
                        width: 100% !important;
                        overflow: hidden;
                        border-radius: 32px;
                    }
                    .card-scale-nutrition {
                        width: 900px;
                        height: 397px;
                        transform-origin: top left;
                        transform: scale(calc(min(100vw - 40px, 900px) / 900));
                    }

                    /* Movement + Sleep stack */
                    .card-movement-sleep {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 20px !important;
                    }
                    .card-movement-sleep > div {
                        min-height: 411px;
                        width: 100%;
                    }

                    /* Bottom row stacks */
                    .card-bottom-row {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 20px !important;
                    }

                    /* Diabetes Care: Figma 963x411 - scale to fit mobile width */
                    .card-scale-diabetes {
                        width: 963px;
                        height: 411px;
                        transform-origin: top left;
                        transform: scale(calc(min(100vw - 40px, 963px) / 963));
                    }

                    .card-bottom-row > div:last-child {
                        min-height: 411px;
                        width: 100%;
                    }
                }

                /* Set heights for scaled containers on mobile to prevent collapse */
                @media (max-width: 768px) {
                    .card-ai-analyzer {
                        height: calc(865px * (100vw - 40px) / 495) !important;
                        max-height: 865px;
                    }
                    .card-nutrition {
                        height: calc(397px * (100vw - 40px) / 900) !important;
                        max-height: 397px;
                    }
                    .card-scale-diabetes {
                        margin-bottom: calc(411px * (100vw - 40px) / 963 - 411px);
                    }
                    .card-bottom-row > div:first-child {
                        height: calc(411px * (100vw - 40px) / 963);
                        max-height: 411px;
                        overflow: hidden;
                        border-radius: 32px;
                    }
                }
            `}</style>
        </section>
    );
};

export default InteractiveGridFeatures;
