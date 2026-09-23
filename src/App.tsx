import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Share2, 
  BookOpen, 
  PenLine, 
  Image as ImageIcon, 
  Settings, 
  RefreshCw, 
  Download,
  ChevronRight,
  LogOut,
  Flower,
  Moon,
  Sun,
  Quote,
  Mic,
  MicOff,
  Activity,
  AlertCircle,
  Music,
  Volume2,
  VolumeX,
  X,
  Waves,
  Sliders,
  Flame,
  CloudRain,
  Bird,
  Sparkles,
  Wind
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { auth, signIn, signOut, db } from './lib/firebase';
import { 
  onAuthStateChanged, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { ArrowLeft, Check, Wine, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { getScriptureRecommendation, getRandomScripture, ScriptureRecommendation } from './services/geminiService';
import { cn, formatDate } from './lib/utils';
import ReflectionDetailModal from './components/ReflectionDetailModal';
import { globalAudioService, AmbientNoise, AmbientNoiseType } from './services/audioService';
import DriftBottleSection from './components/DriftBottleSection';

// --- Components ---

const FluidBackground = ({ mood = 'stone' }: { mood?: string }) => {
  const colors = {
    stone: ['#f5f5f4', '#e7e5e4', '#d6d3d1'],
    Comfort: ['#e0f2fe', '#bae6fd', '#7dd3fc'],
    Encouragement: ['#fef3c7', '#fde68a', '#fcd34d'],
    Wisdom: ['#f5f3ff', '#ddd6fe', '#c4b5fd'],
    Patience: ['#f0fdf4', '#dcfce7', '#bbf7d0'],
    blue: ['#1e3a8a', '#1e40af', '#1d4ed8'], // Sadness / Deep Meditation
  };

  const selectedColors = colors[mood as keyof typeof colors] || colors.stone;

  return (
    <div className="absolute inset-0 overflow-hidden -z-10 bg-white">
      <motion.div 
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] opacity-40 blur-[120px]"
        style={{
          background: `radial-gradient(circle, ${selectedColors[0]} 0%, transparent 70%)`
        }}
      />
      <motion.div 
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -40, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] opacity-30 blur-[100px]"
        style={{
          background: `radial-gradient(circle, ${selectedColors[1]} 0%, transparent 70%)`
        }}
      />
      <motion.div 
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 360],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 left-1/2 w-full h-full opacity-20 blur-[140px]"
        style={{
          background: `radial-gradient(circle, ${selectedColors[2]} 0%, transparent 70%)`
        }}
      />
    </div>
  );
};

const Auth = ({ onComplete }: { onComplete: (watchEnabled: boolean) => void }) => {
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(globalAudioService.getIsEnabled());

  const handleToggleMusic = async () => {
    const nextState = !isPlaying;
    globalAudioService.setEnabled(nextState);
    setIsPlaying(nextState);
    if (nextState) {
      await globalAudioService.play();
    } else {
      globalAudioService.pause();
    }
  };

  const handleAuthSubmit = async (e: any) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('请填写完整的邮箱与密码');
      return;
    }
    setErrorMsg('');
    setAuthLoading(true);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onComplete(watchEnabled);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || '操作失败，请检查输入';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = '邮箱或密码不正确';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = '该邮箱已被注册，请直接登录';
      } else if (err.code === 'auth/weak-password') {
        msg = '密码强度不够，请至少输入 6 位密码';
      } else if (err.code === 'auth/invalid-email') {
        msg = '输入的邮箱格式不正确';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = '“邮箱/密码”登录方式未在您的 Firebase Console 中开启。\n请前往 Firebase 控制台的 Authentication 栏 -> Sign-in method 面板启用“Email/Password”选项。';
      } else if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration')) {
        msg = '请在 Firebase 控制台的 Authentication 栏中启用“邮箱/密码”登录方式';
      }
      setErrorMsg(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6 relative">
      {/* Floating music note icon on Auth page to satisfy "every page has music key" */}
      <div className="absolute top-6 right-6 z-[100]">
        <button
          onClick={handleToggleMusic}
          className="w-10 h-10 bg-white/80 hover:bg-white text-stone-600 hover:text-stone-900 rounded-full border border-stone-200/50 shadow-md backdrop-blur-md flex items-center justify-center cursor-pointer transition-all active:scale-95"
          title={isPlaying ? "静音背景乐" : "播放背景乐"}
        >
          {isPlaying ? <Music className="w-4 h-4 animate-pulse text-amber-600" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
        </button>
      </div>

      <FluidBackground />
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="text-center space-y-8 max-w-md w-full"
      >
        <div className="space-y-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)]">
            <Flower className="w-8 h-8 text-stone-900" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-serif font-light tracking-tight text-stone-900">ScriptureBloom</h1>
            <p className="text-stone-400 font-serif italic text-lg">圣言慢读，静谧之心</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] space-y-6">
          
          {/* Mode Tabs */}
          <div className="flex bg-stone-100/50 p-1.5 rounded-2xl border border-stone-200/30">
            <button
              onClick={() => { setIsRegister(false); setErrorMsg(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer",
                !isRegister ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-700"
              )}
            >
              登 录
            </button>
            <button
              onClick={() => { setIsRegister(true); setErrorMsg(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer",
                isRegister ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-700"
              )}
            >
              注 册
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1.5 pl-1">电子邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-5 py-3.5 bg-stone-50/50 border border-stone-200/40 rounded-2xl text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 focus:bg-white text-sm transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1.5 pl-1">登录密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "设置至少 6 位密码" : "填写登录密码"}
                className="w-full px-5 py-3.5 bg-stone-50/50 border border-stone-200/40 rounded-2xl text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 focus:bg-white text-sm transition-all"
                required
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs leading-relaxed font-medium flex items-start gap-2 border border-rose-100 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-stone-900 text-stone-50 rounded-[1.5rem] hover:bg-stone-800 transition-all font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl cursor-pointer disabled:opacity-50 mt-2"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isRegister ? (
                "注册并开启灵修"
              ) : (
                "登录账户"
              )}
            </button>

            {/* Quick Demo/Test Login Button */}
            <div className="pt-4 border-t border-stone-100/50 mt-2">
              <button
                type="button"
                onClick={async () => {
                  setErrorMsg('');
                  setAuthLoading(true);
                  const demoEmail = 'test_user@scripturebloom.com';
                  const demoPass = 'test123456';
                  setEmail(demoEmail);
                  setPassword(demoPass);
                  try {
                    // Try to sign in first
                    await signInWithEmailAndPassword(auth, demoEmail, demoPass);
                    onComplete(watchEnabled);
                  } catch (err: any) {
                    // If doesn't exist yet, we register it seamlessly
                    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                      try {
                        await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
                        onComplete(watchEnabled);
                      } catch (regErr: any) {
                        setErrorMsg('测试快捷登录失败：' + regErr.message);
                      }
                    } else {
                      setErrorMsg('测试快捷登录失败：' + err.message);
                    }
                  } finally {
                    setAuthLoading(false);
                  }
                }}
                disabled={authLoading}
                className="w-full py-3 bg-amber-50 hover:bg-amber-100/80 text-amber-800 rounded-[1.5rem] border border-amber-100/40 transition-all font-sans text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-600" />
                <span>一键免密测试登录 (推荐体验)</span>
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 text-stone-300 text-[10px] font-bold tracking-widest uppercase">
            <div className="h-px bg-stone-100 flex-1" />
            <span>或</span>
            <div className="h-px bg-stone-100 flex-1" />
          </div>

          {/* Google Login for compatibility */}
          <button 
            type="button"
            onClick={async () => {
              try {
                setErrorMsg('');
                await signIn();
                onComplete(watchEnabled);
              } catch (e: any) {
                console.error(e);
                let msg = 'Google 账号登录失败，请尝试邮箱方式';
                if (e.code === 'auth/operation-not-allowed') {
                  msg = '“Google”登录方式未在您的 Firebase Console 中启用。\n请前往 Firebase 控制台的 Authentication -> Sign-in method 栏启用 Google 登录方式。';
                } else if (e.code === 'auth/cancelled-popup-request' || e.code === 'auth/popup-closed-by-user') {
                  msg = '登录窗口已被关闭。\n由于本系统在 AI Studio 预览框（Iframe）中安全隔离运行，部分浏览器会静默拦截 Google 登录弹窗。\n\n建议您：\n1. 直接使用上方的“邮箱/密码”注册与登录（推荐，无需跨窗口，更顺畅）；\n2. 或点击系统右上角【在新标签页中打开】重新启动程序单独运行，即可完美拉起 Google 快捷登录。';
                }
                setErrorMsg(msg);
              }
            }}
            className="w-full py-3.5 px-6 bg-stone-50 border border-stone-100 hover:bg-stone-100 text-stone-600 rounded-[1.5rem] hover:scale-[1.01] transition-all text-xs font-semibold flex items-center justify-center gap-3 shadow-sm cursor-pointer"
          >
            <Moon className="w-3.5 h-3.5 text-stone-500" />
            使用 Google 账号快捷登录
          </button>

          {/* Wearable Device Toggle */}
          <div 
            onClick={() => setWatchEnabled(!watchEnabled)}
            className="flex items-center gap-4 p-4 rounded-2xl bg-stone-50/30 border border-stone-100/50 cursor-pointer hover:bg-stone-50 transition-all"
          >
            <div className={cn(
              "w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0",
              watchEnabled ? "bg-stone-900 border-stone-900" : "border-stone-300"
            )}>
              {watchEnabled && <div className="w-1 h-1 bg-white rounded-full" />}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600">联动穿戴设备</p>
              <p className="text-[9px] text-stone-400 mt-0.5">心率波动感应将触发灵修打扰判定</p>
            </div>
          </div>

          <p className="text-[9px] text-stone-300 uppercase tracking-[0.2em] font-sans leading-loose">
            邮箱账户享有云端数据保存服务，登录后将自动记住状态，无需重复登录。
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const Navbar = ({ 
  user, 
  isPlayingMusic, 
  onToggleMusic,
  ambientNoises,
  onToggleNoise,
  onNoiseVolumeChange
}: { 
  user: User; 
  isPlayingMusic: boolean; 
  onToggleMusic: () => void;
  ambientNoises: any[];
  onToggleNoise: (id: any) => void;
  onNoiseVolumeChange: (id: any, vol: number) => void;
}) => {
  const [isMixerOpen, setIsMixerOpen] = useState(false);

  const getNoiseIcon = (iconName: string) => {
    switch (iconName) {
      case 'Waves': return <Waves className="w-[14px] h-[14px]" />;
      case 'CloudRain': return <CloudRain className="w-[14px] h-[14px]" />;
      case 'Flame': return <Flame className="w-[14px] h-[14px]" />;
      case 'Sparkles': return <Sparkles className="w-[14px] h-[14px]" />;
      case 'Twitter': return <Bird className="w-[14px] h-[14px]" />;
      case 'Wind': return <Wind className="w-[14px] h-[14px]" />;
      default: return <Sparkles className="w-[14px] h-[14px]" />;
    }
  };

  const getNoiseTagline = (id: string) => {
    switch (id) {
      case 'waves': return '海滩轻拂 浪潮起伏';
      case 'rain': return '细雨叩窗 淅淅沥沥';
      case 'fireplace': return '炉火融融 柴火噼啪';
      case 'crickets': return '夏夜幽林 蛐蛐蛙鸣';
      case 'birds': return '清晨雀鸣 啁啾婉转';
      case 'wind': return '树影婆娑 晚风拂面';
      default: return '自然之韵 平和舒缓';
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 sm:py-6 flex justify-between items-center bg-white/40 backdrop-blur-3xl border-b border-stone-100/50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center text-stone-50 shadow-lg">
          <Flower className="w-5 h-5" />
        </div>
        <span className="font-serif font-semibold tracking-tight text-xl text-stone-900">ScriptureBloom</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Integrated Sound Environment and Music Mixer dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsMixerOpen(!isMixerOpen)}
            className="w-10 h-10 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer relative select-none"
            title="配制灵修专属背景乐与白噪音"
          >
            <Music className={cn("w-5 h-5 text-stone-500", (isPlayingMusic || ambientNoises.some(n => n.isActive)) && "animate-pulse")} />
            {(isPlayingMusic || ambientNoises.some(n => n.isActive)) && (
              <span className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {isMixerOpen && (
              <>
                {/* Custom backdrop dismiss element to close when clicking outside */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setIsMixerOpen(false)} 
                />
                
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ type: "spring", duration: 0.28 }}
                  className="fixed top-[72px] right-4 left-4 w-auto sm:absolute sm:top-auto sm:right-0 sm:left-auto sm:w-96 sm:mt-3 z-50 bg-white/95 backdrop-blur-2xl rounded-[1.8rem] shadow-[0_20px_50px_rgba(28,25,23,0.12)] border border-stone-100 p-5 space-y-4"
                >
                  <div className="pb-1">
                    <h3 className="font-serif text-sm font-semibold text-stone-805">灵修专属环境音境</h3>
                    <p className="text-[9px] text-stone-400">自定义您的专属声音空间，支持多轨叠加混合</p>
                  </div>

                  {/* Piano Background Devotion Selection */}
                  <div className="bg-stone-50/50 rounded-2xl p-3 border border-stone-100/25 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Music className="w-[14px] h-[14px] text-amber-600" />
                        <div>
                          <h4 className="font-serif text-xs font-semibold text-stone-800">背景静心圣乐</h4>
                          <p className="text-[9px] text-stone-400">舒缓钢琴曲：Gymnopédie No. 1</p>
                        </div>
                      </div>
                      <button 
                        onClick={onToggleMusic}
                        className={cn(
                          "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                          isPlayingMusic ? "bg-amber-600" : "bg-stone-250"
                        )}
                        style={{ backgroundColor: isPlayingMusic ? '#d97706' : '#e6e4e2' }}
                      >
                        <motion.span 
                          layout
                          className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] left-[3px]"
                          animate={{ x: isPlayingMusic ? 16 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Natural Noises List */}
                  <div className="space-y-3">
                    <h4 className="font-serif text-[10px] uppercase tracking-wider text-stone-400 font-bold">天籁自然白噪音 (多声源叠加)</h4>
                    
                    <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-0.5">
                      {ambientNoises.map((n) => (
                        <div 
                          key={n.id}
                          className={cn(
                            "flex flex-col gap-2 p-2 rounded-xl border transition-all",
                            n.isActive 
                              ? "bg-amber-50/15 border-amber-100/40 shadow-[0_2px_10px_-4px_rgba(217,119,6,0.1)]" 
                              : "bg-white border-transparent hover:bg-stone-50/50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                                n.isActive ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"
                              )}>
                                {getNoiseIcon(n.icon)}
                              </div>
                              <div>
                                <h5 className="font-serif text-xs font-semibold text-stone-800">{n.name}</h5>
                                <p className="text-[9px] text-stone-400">{getNoiseTagline(n.id)}</p>
                              </div>
                            </div>

                            <button 
                              onClick={() => onToggleNoise(n.id)}
                              className={cn(
                                "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                                n.isActive ? "bg-amber-600" : "bg-stone-250"
                              )}
                              style={{ backgroundColor: n.isActive ? '#d97706' : '#e6e4e2' }}
                            >
                              <motion.span 
                                layout
                                className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] left-[3px]"
                                animate={{ x: n.isActive ? 16 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            </button>
                          </div>

                          {/* Dynamic volume slide bar if active */}
                          {n.isActive && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-3 pt-0.5 px-0.5"
                            >
                              {n.volume === 0 ? (
                                <VolumeX className="w-3 h-3 text-stone-400" />
                              ) : (
                                <Volume2 className="w-3 h-3 text-stone-400" />
                              )}
                              <input 
                                type="range"
                                min="0"
                                max="100"
                                value={Math.round(n.volume * 100)}
                                onChange={(e) => onNoiseVolumeChange(n.id, parseInt(e.target.value) / 100)}
                                className="flex-1 h-1 bg-stone-100 rounded appearance-none cursor-pointer accent-amber-600 outline-none"
                              />
                              <span className="text-[9px] text-stone-400 w-6 text-right font-mono">{Math.round(n.volume * 100)}%</span>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
};

const WallpaperCanvas = ({ 
  recommendation, 
  bgUrl,
  fontFamily = 'serif',
  onSwipeLeft,
  onSwipeRight
}: { 
  recommendation: ScriptureRecommendation | null;
  bgUrl: string;
  fontFamily?: 'serif' | 'sans';
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  if (!recommendation) return (
    <div className="aspect-[9/16] w-full max-w-sm bg-stone-100 rounded-[2.5rem] animate-pulse flex items-center justify-center">
      <p className="text-stone-400 font-serif italic text-sm">寻索那微小的声音...</p>
    </div>
  );

  return (
    <motion.div 
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -100) onSwipeLeft?.();
        if (info.offset.x > 100) onSwipeRight?.();
      }}
      ref={canvasRef}
      id="wallpaper-capture"
      className="aspect-[9/16] w-full max-w-sm relative rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] group cursor-grab active:cursor-grabbing"
      tabIndex={0}
      onContextMenu={(e) => {
        // Mock long press context menu for "Set as Wallpaper" download
        e.preventDefault();
        const link = document.createElement('a');
        toPng(canvasRef.current!).then(url => {
          link.href = url;
          link.download = 'bible-wallpaper.png';
          link.click();
        });
      }}
    >
      <img 
        src={bgUrl} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 select-none"
      />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px]" />
      <div className="absolute inset-0 p-10 flex flex-col justify-center text-white text-center select-none">
        <Quote className="w-8 h-8 opacity-30 mb-8 mx-auto" />
        <div className={cn(
          "space-y-8",
          fontFamily === 'serif' ? "font-serif" : "font-sans"
        )}>
          <p className="text-2xl font-light leading-[1.6] tracking-wide drop-shadow-xl">
            {recommendation.verseInfo.text_zh}
          </p>
          <div className="h-px w-8 bg-white/30 mx-auto" />
          <p className="text-sm font-light leading-relaxed opacity-80 drop-shadow-md px-2 italic">
            {recommendation.verseInfo.text_en}
          </p>
          <p className="pt-6 text-[10px] tracking-[0.3em] font-sans uppercase opacity-60">
            — {recommendation.verseInfo.reference} —
          </p>
        </div>
      </div>
      <div className="absolute bottom-10 left-0 right-0 text-center select-none">
         <span className="text-[10px] tracking-[0.4em] font-sans uppercase opacity-30">ScriptureBloom</span>
      </div>
      
      {/* Swipe hints */}
      <div className="absolute inset-y-0 left-2 flex items-center opacity-0 group-hover:opacity-20 transition-opacity">
         <ChevronRight className="w-6 h-6 rotate-180" />
      </div>
      <div className="absolute inset-y-0 right-2 flex items-center opacity-0 group-hover:opacity-20 transition-opacity">
         <ChevronRight className="w-6 h-6" />
      </div>
    </motion.div>
  );
};

const HistoryCard = ({ 
  item, 
  onOpen 
}: { 
  item: any; 
  onOpen: () => void;
  key?: any;
}) => {
  const MONTHS_ZH = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  
  const dateObj = (() => {
    if (!item.createdAt) return new Date();
    if (typeof item.createdAt.toDate === 'function') {
      return item.createdAt.toDate();
    }
    if (typeof item.createdAt === 'object' && typeof item.createdAt.seconds === 'number') {
      return new Date(item.createdAt.seconds * 1000);
    }
    const d = new Date(item.createdAt);
    return isNaN(d.getTime()) ? new Date() : d;
  })();
  const year = dateObj.getFullYear();
  const monthIdx = dateObj.getMonth();
  const day = dateObj.getDate().toString().padStart(2, '0');
  const monthZh = MONTHS_ZH[monthIdx];

  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.01 }}
      onClick={onOpen}
      className="group w-full bg-white rounded-3xl border border-stone-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.02)] p-6 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.06)] hover:border-stone-200 transition-all flex items-center justify-between cursor-pointer"
    >
      <div className="flex items-center flex-1 min-w-0">
        {/* Date block */}
        <div className="flex flex-col items-center justify-center bg-stone-50 border border-stone-100 rounded-2xl w-16 h-20 mr-5 shrink-0 select-none">
          <span className="text-[9px] font-sans font-extrabold tracking-widest text-[#9d3c30] uppercase leading-none mb-1">
            {monthZh}
          </span>
          <span className="text-2xl font-serif font-black text-stone-800 leading-none">
            {day}
          </span>
          <span className="text-[8px] font-mono text-stone-400 mt-1 leading-none">
            {year}
          </span>
        </div>

        {/* content snippet */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 mb-1 text-stone-300">
            <span className="text-[8px] font-mono tracking-widest text-stone-400">
              心境 REF No. {item.id ? item.id.slice(0, 6).toUpperCase() : 'NEW'}
            </span>
          </div>
          <p className="text-stone-800 font-serif italic text-base leading-relaxed line-clamp-1 truncate pr-2">
            “{item.content}”
          </p>
          <p className="text-stone-400 text-xs font-serif line-clamp-1 truncate opacity-75">
            当时领受：{item.verseText}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {item.insight && (
          <span className="text-[8px] font-display font-medium px-2 py-1 bg-amber-50 text-amber-600 rounded-full shrink-0 select-none">
            已静心
          </span>
        )}
        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-stone-55 transition-all shadow-sm">
          <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-50" />
        </div>
      </div>
    </motion.div>
  );
};

const VoiceInput = ({ onTranscription }: { onTranscription: (text: string) => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscription(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };
    }
  }, [onTranscription]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  return (
    <button 
      onClick={toggleRecording}
      className={cn(
        "p-3 rounded-full transition-all flex items-center justify-center",
        isRecording ? "bg-rose-500 text-white animate-pulse" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
      )}
      title={isRecording ? "停止录音" : "语音输入"}
    >
      {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
};

const DevotionSession = ({ 
  scripture, 
  state,
  onStateChange,
  onEnd 
}: { 
  scripture: ScriptureRecommendation, 
  state: { stage: 'intro' | 'reading' | 'meditation' | 'reflection', timer: number, insight: string },
  onStateChange: (fn: any) => void,
  onEnd: (insight: string) => void 
}) => {
  const { stage, timer, insight } = state;
  const [distractionLevel, setDistractionLevel] = useState(0);
  const [heartRate, setHeartRate] = useState(72);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlayingMusic, setIsPlayingMusic] = useState(globalAudioService.getIsEnabled());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [ambientNoises, setAmbientNoises] = useState(() => globalAudioService.getAmbientNoises());

  const handleToggleNoise = (id: any) => {
    const updated = globalAudioService.toggleAmbientNoise(id);
    setAmbientNoises(updated);
  };

  const handleNoiseVolumeChange = (id: any, vol: number) => {
    const updated = globalAudioService.setAmbientNoiseVolume(id, vol);
    setAmbientNoises(updated);
  };

  const handleToggleMusic = async () => {
    const nextState = !isPlayingMusic;
    globalAudioService.setEnabled(nextState);
    setIsPlayingMusic(nextState);
    if (nextState) {
      await globalAudioService.play();
    } else {
      globalAudioService.pause();
    }
  };

  const getNoiseIcon = (iconName: string) => {
    switch (iconName) {
      case 'Waves': return <Waves className="w-[14px] h-[14px]" />;
      case 'CloudRain': return <CloudRain className="w-[14px] h-[14px]" />;
      case 'Flame': return <Flame className="w-[14px] h-[14px]" />;
      case 'Sparkles': return <Sparkles className="w-[14px] h-[14px]" />;
      case 'Twitter': return <Bird className="w-[14px] h-[14px]" />;
      case 'Wind': return <Wind className="w-[14px] h-[14px]" />;
      default: return <Sparkles className="w-[14px] h-[14px]" />;
    }
  };

  const getNoiseTagline = (id: string) => {
    switch (id) {
      case 'waves': return '海滩轻拂 浪潮起伏';
      case 'rain': return '细雨叩窗 淅淅沥沥';
      case 'fireplace': return '炉火融融 柴火噼啪';
      case 'crickets': return '夏夜幽林 蛐蛐蛙鸣';
      case 'birds': return '清晨雀鸣 啁啾婉转';
      case 'wind': return '树影婆娑 晚风拂面';
      default: return '自然之韵 平和舒缓';
    }
  };

  const setStage = (s: any) => onStateChange((prev: any) => ({ ...prev, stage: s }));
  const setTimer = (fn: (v: number) => number) => onStateChange((prev: any) => ({ ...prev, timer: fn(prev.timer) }));
  const setInsight = (iOrFn: string | ((v: string) => string)) => {
    onStateChange((prev: any) => {
      const nextInsight = typeof iOrFn === 'function' ? iOrFn(prev.insight) : iOrFn;
      return { ...prev, insight: nextInsight };
    });
  };

  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const playAudio = async () => {
      if (globalAudioService.getIsEnabled()) {
        globalAudioService.setVolume(0.12); // "音量要轻柔" - Soft, comfortable volume level for devotion
        await globalAudioService.play();
      }
    };
    
    playAudio();

    return () => {
      globalAudioService.pause();
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      globalAudioService.pause();
    } else {
      if (globalAudioService.getIsEnabled()) {
        globalAudioService.play().catch(e => console.log("Play failed on resume:", e));
      }
    }
  }, [isPaused]);

  useEffect(() => {
    if (stage === 'intro') {
      const t = setTimeout(() => setStage('reading'), 8000);
      return () => clearTimeout(t);
    }

    if (stage === 'reading') {
      const t = setTimeout(() => setStage('meditation'), 15000);
      return () => clearTimeout(t);
    }

    if (stage === 'meditation' && timer > 0 && !isPaused) {
      const interval = setInterval(() => {
        setTimer(v => v - 1);
        setHeartRate(h => h + (Math.random() > 0.5 ? 1 : -1));

        // Simulated movement detection logic - if heart rate pops or random spike
        if (Math.random() > 0.98) {
           setIsPaused(true);
        }
      }, 1000);
      return () => clearInterval(interval);
    }

    if (timer === 0 && stage === 'meditation') {
      setStage('reflection');
    }
  }, [stage, timer, isPaused]);

  useEffect(() => {
    if (stage === 'meditation' && audioRef.current) {
      const targetVol = isPaused ? 0.05 : (0.2 + (distractionLevel / 10) * 0.5);
      audioRef.current.volume = targetVol;
    }
  }, [stage, distractionLevel, isPaused]);

  const progress = ((300 - timer) / 300) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white text-stone-900 flex flex-col items-center justify-center p-6 sm:p-8 text-center overflow-hidden"
    >
      <FluidBackground mood={isPaused ? 'blue' : 'stone'} />
      
      {/* Top Header with Heart rate and a Music toggle button - "每一页都应该可以有停止音乐的按键" */}
      <div className="absolute top-6 sm:top-12 left-0 right-0 px-6 sm:px-12 flex justify-between items-center z-[110]">
         <div className="flex items-center gap-2 text-stone-500">
           <Heart className={cn("w-4 h-4", heartRate > 80 ? "text-rose-500 animate-pulse" : "")} />
           <span className="text-xs font-mono">{heartRate} BPM</span>
           <Activity className="w-4 h-4 ml-2 animate-pulse text-stone-400" />
           <span className="text-xs font-mono">联动中</span>
         </div>
         
         <div className="flex items-center gap-4">
           {/* Devotional audio selector for system background and nature white noise */}
           <div className="relative">
             <button
               onClick={() => setIsMixerOpen(!isMixerOpen)}
               className="w-10 h-10 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer relative select-none"
               title="配制专属背景乐与白噪音"
             >
               <Music className={cn("w-5 h-5 text-stone-500", (isPlayingMusic || ambientNoises.some((n: any) => n.isActive)) && "animate-pulse")} />
               {(isPlayingMusic || ambientNoises.some((n: any) => n.isActive)) && (
                 <span className="absolute top-2.5 right-2.5 flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               )}
             </button>

             <AnimatePresence>
               {isMixerOpen && (
                 <>
                   <div 
                     className="fixed inset-0 z-40 bg-transparent" 
                     onClick={() => setIsMixerOpen(false)} 
                   />
                   <motion.div
                     initial={{ opacity: 0, y: 15, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 15, scale: 0.95 }}
                     transition={{ type: "spring", duration: 0.28 }}
                     className="fixed top-[72px] right-4 left-4 w-auto sm:absolute sm:top-auto sm:right-0 sm:left-auto sm:w-80 sm:mt-3 z-50 bg-white/95 backdrop-blur-2xl rounded-[1.8rem] shadow-[0_20px_50px_rgba(28,25,23,0.12)] border border-stone-100 p-5 space-y-4 text-left"
                   >
                     <div className="pb-1 font-sans">
                       <h3 className="font-serif text-sm font-semibold text-stone-800">静心专属环境音境</h3>
                       <p className="text-[9px] text-stone-400">调节您静默时的专属疗愈声音空间</p>
                     </div>

                     {/* Piano Background Devotion Selection */}
                     <div className="bg-stone-50/50 rounded-2xl p-3 border border-stone-100/25 space-y-2.5 font-sans">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2.5">
                           <Music className="w-[14px] h-[14px] text-amber-600" />
                           <div>
                             <h4 className="font-serif text-xs font-semibold text-stone-800">背景静心圣乐</h4>
                             <p className="text-[9px] text-stone-400">舒缓钢琴：Gymnopédie No. 1</p>
                           </div>
                         </div>
                         <button 
                           onClick={handleToggleMusic}
                           className={cn(
                             "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                             isPlayingMusic ? "bg-amber-600" : "bg-stone-200"
                           )}
                           style={{ backgroundColor: isPlayingMusic ? '#d97706' : '#e6e4e2' }}
                         >
                           <motion.span 
                             layout
                             className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] left-[3px]"
                             animate={{ x: isPlayingMusic ? 16 : 0 }}
                             transition={{ type: "spring", stiffness: 500, damping: 30 }}
                           />
                         </button>
                       </div>
                     </div>

                     {/* Natural Noises List */}
                     <div className="space-y-3 font-sans">
                       <h4 className="font-serif text-[10px] uppercase tracking-wider text-stone-400 font-bold">天籁自然白噪音</h4>
                       
                       <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-0.5">
                         {ambientNoises.map((n) => (
                           <div 
                             key={n.id}
                             className={cn(
                               "flex flex-col gap-2 p-2 rounded-xl border transition-all",
                               n.isActive 
                                 ? "bg-amber-50/15 border-amber-100/40 shadow-[0_2px_10px_-4px_rgba(217,119,6,0.1)]" 
                                 : "bg-white border-transparent hover:bg-stone-50/50"
                             )}
                           >
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2.5">
                                 <div className={cn(
                                   "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                                   n.isActive ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"
                                 )}>
                                   {getNoiseIcon(n.icon)}
                                 </div>
                                 <div>
                                   <h5 className="font-serif text-xs font-semibold text-stone-800">{n.name}</h5>
                                   <p className="text-[9px] text-stone-400">{getNoiseTagline(n.id)}</p>
                                 </div>
                               </div>

                               <button 
                                 onClick={() => handleToggleNoise(n.id)}
                                 className={cn(
                                   "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                                   n.isActive ? "bg-amber-600" : "bg-stone-200"
                                 )}
                                 style={{ backgroundColor: n.isActive ? '#d97706' : '#e6e4e2' }}
                               >
                                 <motion.span 
                                   layout
                                   className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] left-[3px]"
                                   animate={{ x: n.isActive ? 16 : 0 }}
                                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                 />
                               </button>
                             </div>

                             {n.isActive && (
                               <motion.div 
                                 initial={{ opacity: 0, height: 0 }}
                                 animate={{ opacity: 1, height: 'auto' }}
                                 className="px-1 pb-1 flex items-center gap-3"
                               >
                                 <VolumeX className="w-3 h-3 text-stone-400" />
                                 <input 
                                   type="range"
                                   min="0"
                                   max="1"
                                   step="0.05"
                                   value={n.volume}
                                   onChange={(e) => handleNoiseVolumeChange(n.id, parseFloat(e.target.value))}
                                   className="flex-1 accent-amber-600 h-1 bg-stone-200 rounded-lg cursor-pointer text-xs"
                                 />
                                 <Volume2 className="w-3 h-3 text-stone-400" />
                               </motion.div>
                             )}
                           </div>
                         ))}
                       </div>
                     </div>
                   </motion.div>
                 </>
               )}
             </AnimatePresence>
           </div>

           <div className="flex items-center gap-2">
             <div className="text-xs font-mono tabular-nums text-stone-500 bg-stone-100/60 px-3 py-1.5 rounded-full select-none">
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
             </div>
             <button 
               onClick={() => setStage('reflection')}
               className="text-xs text-rose-500 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/80 px-3 py-1.5 rounded-full transition-all font-semibold tracking-wider cursor-pointer"
               title="中止灵修"
             >
               中止
             </button>
           </div>
         </div>
      </div>

      <AnimatePresence mode="wait">
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[120] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 sm:p-12 text-center"
          >
             <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center mb-8 shadow-2xl">
                <Moon className="w-8 h-8 text-stone-100" />
             </div>
             <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mb-3 font-light">世界打扰了你的静默</h2>
             <p className="text-stone-400 font-serif italic mb-10 max-w-sm text-sm sm:text-base leading-relaxed">
               动作感应检测到了物理波动。深呼吸，是否回到刚才的圣言中？
             </p>
             <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                <button 
                  onClick={() => setIsPaused(false)}
                  className="flex-1 py-4 bg-stone-900 text-stone-50 rounded-full font-display font-semibold tracking-widest text-[11px] shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  回到当下
                </button>
                <button 
                  onClick={() => onEnd(insight)}
                  className="flex-1 py-4 bg-white text-stone-400 rounded-full font-display font-semibold tracking-widest text-[11px] border border-stone-200 hover:bg-stone-50 transition-all cursor-pointer"
                >
                  结束这一刻
                </button>
             </div>
          </motion.div>
        )}

        {stage === 'intro' && (
          <motion.div 
            key="intro"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8 my-auto mt-20 sm:mt-0 px-6"
          >
            <div className="relative">
              <motion.div 
                animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-stone-200 rounded-full blur-3xl"
              />
              <div className="w-28 h-28 rounded-full border border-stone-100 bg-white shadow-sm flex items-center justify-center mx-auto relative z-10">
                 <Flower className="w-10 h-10 text-stone-300" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-serif font-light text-stone-900 tracking-tight">请在安静处坐下</h2>
              <p className="text-stone-400 font-serif italic text-base sm:text-lg">我们要进入灵修了，屏息以待...</p>
            </div>
          </motion.div>
        )}

        {(stage === 'reading' || stage === 'meditation') && (
          <motion.div 
            key="reading-meditation"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-2xl w-full my-auto mt-28 sm:mt-0 px-6 pt-12 sm:pt-0"
          >
             <div className="space-y-12">
                <div className="space-y-6 relative">
                   <Quote className="hidden sm:block absolute -top-16 -left-8 w-16 h-16 text-stone-100/50 -z-10 select-none" />
                   <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif leading-[1.5] text-stone-900 font-light italic px-2">
                     {scripture.verseInfo.text_zh}
                   </p>
                   <div className="h-[1px] w-12 bg-stone-900/10 mx-auto" />
                   <p className="text-stone-400 font-serif leading-relaxed text-base sm:text-lg px-6 italic font-light max-w-xl mx-auto">
                     {scripture.verseInfo.text_en}
                   </p>
                   <p className="text-[10px] tracking-[0.3em] font-mono uppercase text-stone-300">
                     {scripture.verseInfo.reference}
                   </p>
                </div>
 
                <div 
                   className={cn(
                     "pt-6 space-y-12 transition-all duration-1000",
                     stage === 'meditation' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                   )}
                 >



                     <div className="flex justify-center items-center gap-12 sm:gap-24">
                        <div className="text-center group">
                           <motion.div 
                             animate={{ height: [40, 120, 40] }}
                             transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                             className="w-[1px] bg-stone-300 mx-auto rounded-full"
                           />
                           <p className="text-[9px] mt-4 uppercase tracking-[0.3em] font-display font-medium text-stone-400">吸气</p>
                        </div>
                        <div className="text-center group">
                           <div className="w-16 h-16 sm:w-20 sm:h-20 border border-stone-200 rounded-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-stone-900 rounded-full" />
                           </div>
                           <p className="text-[9px] mt-4 uppercase tracking-[0.3em] font-display font-medium text-stone-400">觉察</p>
                        </div>
                        <div className="text-center group">
                           <motion.div 
                             animate={{ height: [120, 40, 120] }}
                             transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                             className="w-[1px] bg-stone-300 mx-auto rounded-full"
                           />
                           <p className="text-[9px] mt-4 uppercase tracking-[0.3em] font-display font-medium text-stone-400">呼气</p>
                        </div>
                     </div>
 

                </div>
             </div>
          </motion.div>
        )}
 
        {stage === 'reflection' && (
          <motion.div 
            key="reflection"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl space-y-8 my-auto mt-20 sm:mt-0 px-4 pt-12 sm:pt-0"
          >
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-4xl font-serif font-light text-stone-900">静默灵修所得</h2>
              <p className="text-stone-400 font-serif italic text-sm sm:text-lg">睁开眼，写下此时上帝在你心中的低语</p>
            </div>
            
            <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-stone-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] space-y-6">
              <textarea 
                value={insight}
                onChange={(e) => setInsight(e.target.value)}
                placeholder="在此记录下这段静谧时光中的亮光..."
                className="w-full bg-transparent border-none focus:ring-0 text-stone-800 font-serif italic text-lg sm:text-xl resize-none min-h-[120px] sm:min-h-[180px] leading-relaxed placeholder:text-stone-200"
              />
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-6 border-t border-stone-50">
                <span className="text-[9px] font-mono text-stone-300 uppercase tracking-widest text-center sm:text-left">感悟将自动存留于你的过往心迹中</span>
                <VoiceInput onTranscription={(t) => setInsight(prev => prev ? prev + ' ' + t : t)} />
              </div>
            </div>
 
            <button 
              onClick={() => onEnd(insight)}
              className="w-full py-5 bg-stone-900 text-stone-50 rounded-[2rem] font-display font-bold uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-stone-800 hover:scale-[1.01] transition-all cursor-pointer"
            >
              存留心迹并封存
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>({
    uid: 'guest_user_123',
    displayName: '静默客旅',
    email: 'guest@scripturebloom.com',
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'
  } as any);
  const [loading, setLoading] = useState(false);
  const [feeling, setFeeling] = useState('');
  const [recommendation, setRecommendation] = useState<ScriptureRecommendation | null>(null);
  const [recommendationHistory, setRecommendationHistory] = useState<Array<{rec: ScriptureRecommendation, bg: string}>>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [bgUrl, setBgUrl] = useState('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=1000');
  const [categories, setCategories] = useState<string[]>(['Wisdom']);
  const [isMeditating, setIsMeditating] = useState(false);
  const [devotionState, setDevotionState] = useState<{
    stage: 'intro' | 'reading' | 'meditation' | 'reflection';
    timer: number;
    insight: string;
  }>({
    stage: 'intro',
    timer: 300,
    insight: ''
  });
  const [history, setHistory] = useState<any[]>([]);
  const [watchEnabled, setWatchEnabled] = useState(false);
  const [selectedReflection, setSelectedReflection] = useState<any | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(globalAudioService.getIsEnabled());
  const [isDriftBottleOpen, setIsDriftBottleOpen] = useState(false);
  const [showMobileWallpaperView, setShowMobileWallpaperView] = useState(false);
  const [voiceRecognized, setVoiceRecognized] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom nature white noise mixing state
  const [ambientNoises, setAmbientNoises] = useState<AmbientNoise[]>(() => globalAudioService.getAmbientNoises());

  const handleToggleNoise = (id: AmbientNoiseType) => {
    const updated = globalAudioService.toggleAmbientNoise(id);
    setAmbientNoises(updated);
  };

  const handleNoiseVolumeChange = (id: AmbientNoiseType, vol: number) => {
    const updated = globalAudioService.setAmbientNoiseVolume(id, vol);
    setAmbientNoises(updated);
  };

  // Initialize background contemplation music
  useEffect(() => {
    setIsPlayingMusic(globalAudioService.getIsEnabled());
    if (globalAudioService.getIsEnabled()) {
      globalAudioService.play().catch(e => console.warn('Autoplay check:', e));
    }
    return () => {
      globalAudioService.pause();
    };
  }, []);

  // Soft toggle to suspend global music when devotion modal runs
  useEffect(() => {
    if (isMeditating) {
      if (isPlayingMusic) {
        globalAudioService.pause();
      }
    } else {
      if (isPlayingMusic && globalAudioService.getIsEnabled()) {
        globalAudioService.play().catch(e => console.log('Audio resume blocked:', e));
      }
    }
  }, [isMeditating, isPlayingMusic]);

  const toggleGlobalMusic = async () => {
    const nextState = !isPlayingMusic;
    globalAudioService.setEnabled(nextState);
    setIsPlayingMusic(nextState);
    if (nextState) {
      await globalAudioService.play();
    } else {
      globalAudioService.pause();
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        // Automatically default to Guest Mode to bypass authorization errors on standard platforms
        setUser({
          uid: 'guest_user_123',
          displayName: '静默客旅',
          email: 'guest@scripturebloom.com',
          photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'
        } as any);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (user) {
      if (user.uid === 'guest_user_123') {
        // Load reflections from localStorage for the guest user
        const localData = localStorage.getItem('guest_reflections');
        if (localData) {
          try {
            setHistory(JSON.parse(localData));
          } catch (e) {
            console.error('Failed to load guest reflections:', e);
          }
        }
        return;
      }

      const q = query(
        collection(db, `users/${user.uid}/reflections`),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => {
        console.warn("Firestore subscription failed, switching to local state fallback:", err);
        const localData = localStorage.getItem('guest_reflections');
        if (localData) {
          try {
            setHistory(JSON.parse(localData));
          } catch (e) {
            console.error('Failed to parse guest reflections backup:', e);
          }
        }
      });
      return unsubscribe;
    }
  }, [user]);

  const fetchScripture = async (isManual = false, overrideFeeling?: string) => {
    setIsGenerating(true);
    try {
      let res;
      const targetFeeling = overrideFeeling !== undefined ? overrideFeeling : feeling;
      // 50% random chance or if feeling is empty
      if (!isManual && (Math.random() > 0.5 || !targetFeeling)) {
         res = await getRandomScripture(categories[0] || 'Wisdom');
      } else {
         res = await getScriptureRecommendation(targetFeeling, categories);
      }
      
      // Random background logic
      const randomBgs = [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1434725039720-88835459067e?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1000'
      ];
      const newBg = randomBgs[Math.floor(Math.random() * randomBgs.length)];

      setRecommendation(res);
      setBgUrl(newBg);
      setRecommendationHistory(prev => [...prev, { rec: res, bg: newBg }]);
      setCurrentIndex(prev => prev + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentIndex < recommendationHistory.length - 1) {
      const next = recommendationHistory[currentIndex + 1];
      setRecommendation(next.rec);
      setBgUrl(next.bg);
      setCurrentIndex(currentIndex + 1);
    } else if (direction === 'right' && currentIndex > 0) {
      const prev = recommendationHistory[currentIndex - 1];
      setRecommendation(prev.rec);
      setBgUrl(prev.bg);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const saveReflection = async () => {
    if (!user || !feeling || !recommendation) return;
    const newDoc = {
      userId: user.uid,
      content: feeling,
      verseId: recommendation.verseInfo.reference,
      verseText: recommendation.verseInfo.text_zh,
      verseTextEn: recommendation.verseInfo.text_en || "",
      backgroundImageUrl: bgUrl || "",
    };

    if (user.uid === 'guest_user_123') {
      const localItem = {
        id: 'local_' + Date.now(),
        ...newDoc,
        createdAt: { toDate: () => new Date(), seconds: Date.now() / 1000 }
      };
      const updated = [localItem, ...history];
      setHistory(updated);
      localStorage.setItem('guest_reflections', JSON.stringify(updated));
      setFeeling('');
      return;
    }

    try {
      await addDoc(collection(db, `users/${user.uid}/reflections`), {
        ...newDoc,
        createdAt: serverTimestamp(),
      });
      setFeeling('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    const el = document.getElementById('wallpaper-capture');
    if (el) {
      const dataUrl = await toPng(el);
      const link = document.createElement('a');
      link.download = `scripture-wallpaper-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleEndDevotion = async (insightText: string) => {
    if (user && recommendation) {
      const newDoc = {
        userId: user.uid,
        content: feeling || "静默灵修",
        insight: insightText,
        verseId: recommendation.verseInfo.reference,
        verseText: recommendation.verseInfo.text_zh,
        verseTextEn: recommendation.verseInfo.text_en || "",
        backgroundImageUrl: bgUrl || "",
      };

      if (user.uid === 'guest_user_123') {
        const localItem = {
          id: 'local_' + Date.now(),
          ...newDoc,
          createdAt: { toDate: () => new Date(), seconds: Date.now() / 1000 }
        };
        const updated = [localItem, ...history];
        setHistory(updated);
        localStorage.setItem('guest_reflections', JSON.stringify(updated));
      } else {
        try {
          await addDoc(collection(db, `users/${user.uid}/reflections`), {
            ...newDoc,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error(e);
        }
      }
    }
    setFeeling(''); 
    setIsMeditating(false);
    // Reset state for next time
    setDevotionState({
      stage: 'intro',
      timer: 300,
      insight: ''
    });
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-stone-50 pb-32 pt-20">
      <Navbar 
        user={user} 
        isPlayingMusic={isPlayingMusic} 
        onToggleMusic={toggleGlobalMusic} 
        ambientNoises={ambientNoises}
        onToggleNoise={handleToggleNoise}
        onNoiseVolumeChange={handleNoiseVolumeChange}
      />
      
      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 py-12">
        {/* Left column - Hidden on mobile if wallpaper view is active */}
        <div className={cn(
          "lg:col-span-7 space-y-12",
          showMobileWallpaperView ? "hidden lg:block" : "block"
        )}>
          <section className="space-y-8">
            <h2 className="text-4xl font-serif font-light text-stone-800">此刻的心境</h2>
            <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl overflow-hidden p-8 space-y-6 focus-within:border-stone-200 transition-all">
               <textarea 
                value={feeling}
                onChange={(e) => {
                  setFeeling(e.target.value);
                }}
                placeholder="分享一段心得，或者寻求平安..."
                className="w-full h-32 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 transition-all resize-none font-serif italic text-xl text-stone-700 placeholder:text-stone-200 leading-relaxed shadow-none"
               />
               <div className="flex justify-between items-center pt-6 border-t border-stone-50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <VoiceInput onTranscription={async (t) => {
                      const newFeeling = feeling ? feeling + ' ' + t : t;
                      setFeeling(newFeeling);
                      await fetchScripture(true, newFeeling);
                      setShowMobileWallpaperView(true);
                    }} />
                    {watchEnabled && (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        <Activity className="w-3 h-3 animate-pulse" />
                        Watch 已联通
                      </span>
                    )}
                  </div>
                  <PenLine className="w-5 h-5 text-stone-100" />
               </div>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              {['Comfort', 'Encouragement', 'Wisdom', 'Patience'].map((cat) => {
                const isSelected = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setCategories(prev => 
                      isSelected ? prev.filter(c => c !== cat) : [...prev, cat]
                    )}
                    className={cn(
                      "px-8 py-3 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all border cursor-pointer",
                      isSelected
                        ? "bg-stone-900 text-stone-50 border-stone-100 shadow-md scale-105" 
                        : "bg-white text-stone-350 border-stone-100 hover:border-stone-200"
                    )}
                  >
                    {cat === 'Comfort' ? '安慰' : cat === 'Encouragement' ? '鼓励' : cat === 'Wisdom' ? '智慧' : '忍耐'}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button 
                disabled={isGenerating}
                onClick={async () => {
                  await fetchScripture(true);
                  setShowMobileWallpaperView(true);
                }}
                className={cn(
                  "w-full py-5 bg-stone-900 text-stone-50 rounded-[1.5rem] font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)] active:scale-[0.98] cursor-pointer",
                  isGenerating && "opacity-75 pointer-events-none"
                )}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-stone-50" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    正在聆听其道中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    聆听上帝的话语
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="space-y-8 pt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-serif font-light text-stone-800 flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-stone-300" />
                过往心迹
              </h2>
            </div>
            <div className="space-y-5">
              {history.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-stone-100 rounded-[2rem]">
                  <p className="text-stone-300 font-serif italic">暂无记录，愿圣言开始在你的生命中流动</p>
                </div>
              ) : (
                history.map((item) => (
                  <HistoryCard 
                    key={item.id} 
                    item={item} 
                    onOpen={() => setSelectedReflection(item)}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right column - Hidden on mobile if wallpaper view is not active */}
        <div className={cn(
          "lg:col-span-5 flex flex-col items-center",
          showMobileWallpaperView ? "block w-full max-w-md mx-auto" : "hidden lg:flex"
        )}>
          {/* Back to Home card action on mobile only */}
          {showMobileWallpaperView && (
            <button
              onClick={() => setShowMobileWallpaperView(false)}
              className="lg:hidden self-start flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-400 hover:text-stone-700 transition-colors mb-6 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              返回此刻心境
            </button>
          )}

          <div className="sticky top-32 w-full flex flex-col items-center space-y-10">
            <WallpaperCanvas 
              recommendation={recommendation} 
              bgUrl={bgUrl} 
              onSwipeLeft={() => handleSwipe('left')}
              onSwipeRight={() => handleSwipe('right')}
            />
            
            <div className="flex w-full max-w-sm gap-6">
              <button 
                onClick={handleShare}
                className="flex-1 py-5 bg-stone-100 text-stone-600 rounded-[1.5rem] flex items-center justify-center gap-2 hover:bg-stone-200 transition-all font-medium cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                分享壁纸
              </button>
              <button 
                onClick={() => setIsMeditating(true)}
                className="flex-1 py-5 bg-stone-900 text-stone-50 rounded-[1.5rem] flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-xl font-medium cursor-pointer"
              >
                <Activity className="w-4 h-4 animate-pulse" />
                静默灵修
              </button>
            </div>
            
            {recommendationHistory.length > 1 && (
              <p className="text-[10px] text-stone-350 uppercase tracking-widest font-sans">
                左右滑动查看过往经文卡
              </p>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isMeditating && recommendation && (
          <DevotionSession 
            scripture={recommendation} 
            state={devotionState}
            onStateChange={setDevotionState}
            onEnd={handleEndDevotion} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedReflection && (
          <ReflectionDetailModal
            item={selectedReflection}
            uid={user.uid}
            onClose={() => setSelectedReflection(null)}
            onDeleteReflection={async (id) => {
              if (user.uid === 'guest_user_123') {
                const updated = history.filter(item => item.id !== id);
                setHistory(updated);
                localStorage.setItem('guest_reflections', JSON.stringify(updated));
                setSelectedReflection(null);
                return;
              }
              try {
                await deleteDoc(doc(db, `users/${user.uid}/reflections`, id));
              } catch (e) {
                console.error("Failed to delete reflection:", e);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating Drift Bottle Trigger Button - "一个小瓶子 icon" */}
      {user && !isMeditating && (
        <motion.div 
          className="fixed bottom-8 right-8 z-[90] flex items-center justify-end"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        >
          <button 
            onClick={() => setIsDriftBottleOpen(true)}
            className="group relative flex items-center gap-2.5 px-5 py-4 bg-amber-50/95 hover:bg-amber-100/95 text-amber-800 rounded-full shadow-[0_12px_24px_-8px_rgba(217,119,6,0.15)] border border-amber-200/40 hover:scale-102 active:scale-98 transition-all text-sm font-semibold cursor-pointer"
            title="点开主内漂流瓶"
          >
            <Wine className="w-[18px] h-[18px] text-amber-600 shrink-0" />
            <span className="font-serif tracking-wide pr-0.5">主内漂流瓶</span>
          </button>
        </motion.div>
      )}

      {/* Immersive Drift Bottle Fellowship Modal - Opened by Clicking the Bottle */}
      <AnimatePresence>
        {isDriftBottleOpen && user && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/40 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 80, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 80, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 185 }}
              className="relative w-full max-w-5xl my-auto bg-stone-50/95 rounded-[3rem] shadow-[0_32px_80px_rgba(0,0,0,0.25)] border border-stone-200/40 overflow-hidden"
            >
              <div className="absolute top-6 right-6 z-[130]">
                <button 
                  onClick={() => setIsDriftBottleOpen(false)}
                  className="w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-md flex items-center justify-center text-stone-500 hover:text-stone-850 transition-all cursor-pointer border border-stone-200/30"
                  title="关闭漂流瓶"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-1 sm:p-4 md:p-6 max-h-[85vh] overflow-y-auto">
                <DriftBottleSection 
                  user={user}
                  userLatestFeeling={feeling || (history[0]?.mood || '')}
                  userLatestReflection={feeling || (history[0]?.content || '')}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
