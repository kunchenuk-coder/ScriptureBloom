import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  orderBy, 
  onSnapshot,
  increment,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  moderatePrayer, 
  matchDriftBottles, 
  DriftBottleCandidate 
} from '../services/geminiService';
import { 
  Compass, 
  X, 
  Send, 
  Heart, 
  MessageSquare, 
  Sparkles, 
  AlertCircle, 
  Inbox, 
  CheckCircle2, 
  Anchor, 
  BookOpen,
  Waves
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const parseDate = (createdAtAny: any): Date => {
  if (!createdAtAny) return new Date();
  if (typeof createdAtAny.toDate === 'function') {
    return createdAtAny.toDate();
  }
  if (typeof createdAtAny === 'object' && typeof createdAtAny.seconds === 'number') {
    return new Date(createdAtAny.seconds * 1000);
  }
  const d = new Date(createdAtAny);
  return isNaN(d.getTime()) ? new Date() : d;
};

interface DriftBottleSectionProps {
  user: any;
  userLatestFeeling: string;
  userLatestReflection: string;
}

export default function DriftBottleSection({ 
  user, 
  userLatestFeeling, 
  userLatestReflection 
}: DriftBottleSectionProps) {
  const [activeTab, setActiveTab] = useState<'sea' | 'my-bottles'>('sea');
  const [bottleContent, setBottleContent] = useState('');
  const [selectedMood, setSelectedMood] = useState('迷茫');
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState(false);

  const [driftBottles, setDriftBottles] = useState<any[]>([]);
  const [myBottles, setMyBottles] = useState<any[]>([]);
  const [selectedBottle, setSelectedBottle] = useState<any | null>(null);
  
  // Prayer drafting states
  const [prayerText, setPrayerText] = useState('');
  const [isSubmittingPrayer, setIsSubmittingPrayer] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [prayerSuccess, setPrayerSuccess] = useState(false);

  // Active prayers viewing state for my bottles
  const [selectedMyBottle, setSelectedMyBottle] = useState<any | null>(null);
  const [myBottlePrayers, setMyBottlePrayers] = useState<any[]>([]);
  const [loadingPrayers, setLoadingPrayers] = useState(false);

  const moodsList = ['忧伤', '迷茫', '感恩', '软弱', '惧怕', '喜乐', '得胜', '静候'];

  // 1. Fetch user's own drift bottles
  useEffect(() => {
    if (!user) return;
    if (user.uid === 'guest_user_123') {
      const stored = localStorage.getItem('guest_my_bottles');
      if (stored) {
        setMyBottles(JSON.parse(stored));
      } else {
        // Prepopulate standard guest bottle
        const defaultMy = [
          {
            id: 'mock_my_1',
            senderId: 'guest_user_123',
            content: '在寂静的晨光中，求主赐予我一整天在日常生活/职场中的平静和智慧，能用温柔和诚实待人。',
            mood: '静候',
            prayedCount: 1,
            createdAt: new Date(Date.now() - 3600000 * 2)
          }
        ];
        localStorage.setItem('guest_my_bottles', JSON.stringify(defaultMy));
        setMyBottles(defaultMy);
      }
      return;
    }

    const q = query(
      collection(db, 'driftBottles'),
      where('senderId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bottles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      bottles.sort((a: any, b: any) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || 0;
        return tB - tA;
      });
      setMyBottles(bottles);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'driftBottles');
    });
    return unsubscribe;
  }, [user]);

  // 2. Search resonant drift bottles from other users
  const searchMatchingBottles = async () => {
    if (!user) return;
    if (user.uid === 'guest_user_123') {
      const localCommunityKey = 'guest_community_bottles';
      const storedComm = localStorage.getItem(localCommunityKey);
      let communityBottles = [];
      if (storedComm) {
        communityBottles = JSON.parse(storedComm);
      } else {
        communityBottles = [
          {
            id: 'comm_1',
            senderId: 'user_helen',
            senderName: '海伦姊妹',
            content: '孩子今年要面临重要阶段，内心十分焦虑。求主的灵平静她的心，让她知道结果在主手中，尽心即可。',
            mood: '忧伤',
            prayedCount: 3,
            createdAt: new Date(Date.now() - 3600000 * 5)
          },
          {
            id: 'comm_2',
            senderId: 'user_david',
            senderName: '大卫弟兄',
            content: '感谢主！连续两周努力准备，今天事情终于顺利度过。感谢一路上同工们的陪伴和主的保守！',
            mood: '感恩',
            prayedCount: 8,
            createdAt: new Date(Date.now() - 3600000 * 12)
          },
          {
            id: 'comm_3',
            senderId: 'user_sarah',
            senderName: '撒拉姊妹',
            content: '最近面临生活转折点，感到前路未卜，心里有些迷茫。求主赐予我清晰的异象和满溢的信心！',
            mood: '迷茫',
            prayedCount: 5,
            createdAt: new Date(Date.now() - 3600000 * 24)
          },
          {
            id: 'comm_4',
            senderId: 'user_john',
            senderName: '约翰弟兄',
            content: '正在复盘最近的读书分享，希望能给身边的伙伴带去安慰。求神让我的口成为恩典的通道。',
            mood: '静候',
            prayedCount: 2,
            createdAt: new Date(Date.now() - 3600000 * 3)
          }
        ];
        localStorage.setItem(localCommunityKey, JSON.stringify(communityBottles));
      }
      setDriftBottles(communityBottles);
      return;
    }

    try {
      // Fetch some recent public bottles (excluding current user's)
      const q = query(
        collection(db, 'driftBottles'),
        where('senderId', '!=', user.uid),
        limit(40)
      );
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'driftBottles');
        return;
      }
      const candidates: DriftBottleCandidate[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.content,
          mood: data.mood,
          ...data
        };
      });

      if (candidates.length === 0) {
        setDriftBottles([]);
        return;
      }

      // Utilise Gemini to filter/match bottles that have a high spiritual/emotional resonance 
      // with current user's latest mood + reflection
      const currentMood = userLatestFeeling || 'Seeking peace';
      const currentRefl = userLatestReflection || 'Looking for spiritual fellowship';

      const matchedIds = await matchDriftBottles(
        currentMood,
        currentRefl,
        candidates
      );

      // Filter global candidates that match selected IDs from Gemini, or return up to 3 fallback
      let matchedList = candidates.filter(b => matchedIds.includes(b.id));
      if (matchedList.length === 0) {
        matchedList = candidates.slice(0, 3);
      }
      setDriftBottles(matchedList);
    } catch (e) {
      console.error("Match error details:", e);
    }
  };

  // Trigger matching on component mount and tab switch
  useEffect(() => {
    searchMatchingBottles();
  }, [user, userLatestFeeling, userLatestReflection]);

  // 3. Launch a drift bottle anonymously
  const launchBottle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bottleContent.trim() || !user) return;

    setIsLaunching(true);
    if (user.uid === 'guest_user_123') {
      try {
        const bottleId = `bottle_${Date.now()}_guest`;
        const newBottle = {
          id: bottleId,
          senderId: user.uid,
          content: bottleContent,
          mood: selectedMood,
          prayedCount: 0,
          createdAt: new Date()
        };
        const updated = [newBottle, ...myBottles];
        setMyBottles(updated);
        localStorage.setItem('guest_my_bottles', JSON.stringify(updated));

        setBottleContent('');
        setLaunchSuccess(true);
        setTimeout(() => setLaunchSuccess(false), 3000);
      } catch (err) {
        console.error('Launch local bottle error:', err);
      } finally {
        setIsLaunching(false);
      }
      return;
    }

    try {
      const bottleId = `bottle_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const bottleRef = doc(db, 'driftBottles', bottleId);
      
      await setDoc(bottleRef, {
        id: bottleId,
        senderId: user.uid,
        content: bottleContent,
        mood: selectedMood,
        prayedCount: 0,
        createdAt: new Date() // Will be resolved by server client nicely
      });

      setBottleContent('');
      setLaunchSuccess(true);
      setTimeout(() => setLaunchSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'driftBottles');
    } finally {
      setIsLaunching(false);
    }
  };

  // 4. Pray for an anonymous user (with AI Moderation)
  const submitPrayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerText.trim() || !selectedBottle || !user) return;

    setIsSubmittingPrayer(true);
    setModerationError(null);

    try {
      // AI Moderation block to double check there is no malice or toxic elements
      const modResult = await moderatePrayer(prayerText);
      
      if (!modResult.isApproved) {
        setModerationError(
          modResult.reason || 
          "AI 圣言审核：您的代祷词中含有不太适宜的词句，请调整并用真心重写，多些主内关爱与温良。"
        );
        setIsSubmittingPrayer(false);
        return;
      }

      if (user.uid === 'guest_user_123') {
        const prayerId = `prayer_${Date.now()}`;
        const newPrayer = {
          id: prayerId,
          bottleId: selectedBottle.id,
          senderId: user.uid,
          content: prayerText,
          launcherId: selectedBottle.senderId,
          isApproved: true,
          createdAt: new Date()
        };

        // Increment local my drift bottle or local community bottle counts
        const my_stored = localStorage.getItem('guest_my_bottles');
        if (my_stored) {
          const myB = JSON.parse(my_stored);
          const my_updated = myB.map((b: any) => {
            if (b.id === selectedBottle.id) {
              return { ...b, prayedCount: (b.prayedCount || 0) + 1 };
            }
            return b;
          });
          setMyBottles(my_updated);
          localStorage.setItem('guest_my_bottles', JSON.stringify(my_updated));
        }

        const comm_stored = localStorage.getItem('guest_community_bottles');
        if (comm_stored) {
          const commArray = JSON.parse(comm_stored);
          const comm_updated = commArray.map((b: any) => {
            if (b.id === selectedBottle.id) {
              return { ...b, prayedCount: (b.prayedCount || 0) + 1 };
            }
            return b;
          });
          localStorage.setItem('guest_community_bottles', JSON.stringify(comm_updated));
          setDriftBottles(comm_updated);
        }

        const storedPrayers_key = `guest_prayers_${selectedBottle.id}`;
        const prevPrayers = localStorage.getItem(storedPrayers_key);
        const prayersList = prevPrayers ? JSON.parse(prevPrayers) : [];
        localStorage.setItem(storedPrayers_key, JSON.stringify([newPrayer, ...prayersList]));

        setPrayerText('');
        setPrayerSuccess(true);
        setSelectedBottle((prev: any) => ({
          ...prev,
          prayedCount: (prev.prayedCount || 0) + 1
        }));

        setTimeout(() => {
          setPrayerSuccess(false);
          setSelectedBottle(null);
        }, 2000);

        setIsSubmittingPrayer(false);
        return;
      }

      // AI approved, proceed with saving the prayer under subcollection
      const prayerId = `prayer_${Date.now()}`;
      const prayerRef = doc(db, `driftBottles/${selectedBottle.id}/prayers`, prayerId);

      await setDoc(prayerRef, {
        id: prayerId,
        bottleId: selectedBottle.id,
        senderId: user.uid,
        content: prayerText,
        launcherId: selectedBottle.senderId,
        isApproved: true,
        createdAt: new Date()
      });

      // Increment sprayed/prayed count globally on the bottle
      await updateDoc(doc(db, 'driftBottles', selectedBottle.id), {
        prayedCount: increment(1)
      });

      setPrayerText('');
      setPrayerSuccess(true);
      
      // Update local state to reflect increment immediately
      setSelectedBottle((prev: any) => ({
        ...prev,
        prayedCount: (prev.prayedCount || 0) + 1
      }));

      setTimeout(() => {
        setPrayerSuccess(false);
        setSelectedBottle(null);
      }, 2000);

    } catch (err) {
      if (user.uid !== 'guest_user_123') {
        handleFirestoreError(err, OperationType.WRITE, `driftBottles/${selectedBottle.id}/prayers`);
      }
      setModerationError("由于网络干扰，代祷未能送达。请稍后重试。");
    } finally {
      setIsSubmittingPrayer(false);
    }
  };

  // 5. Watch prayers on my selected bottle
  const selectMyBottleForPrayers = (bottle: any) => {
    setSelectedMyBottle(bottle);
    setLoadingPrayers(true);
    
    if (user.uid === 'guest_user_123') {
      const storedPrayers_key = `guest_prayers_${bottle.id}`;
      const prevPrayers = localStorage.getItem(storedPrayers_key);
      let prayers = prevPrayers ? JSON.parse(prevPrayers) : [];
      if (prayers.length === 0 && bottle.id === 'mock_my_1') {
        prayers = [
          {
            id: 'mock_prayer_1',
            bottleId: 'mock_my_1',
            senderId: 'user_timothy',
            senderName: '提摩太弟兄',
            content: '阿门！同心合意为您祷告。愿主赐您平静安稳的心灵，在这个时刻作盐作光，用温柔待人，用信心得着应许。主的恩典够你用的！',
            createdAt: new Date(Date.now() - 3600 * 1000)
          }
        ];
        localStorage.setItem(storedPrayers_key, JSON.stringify(prayers));
      }
      setMyBottlePrayers(prayers);
      setLoadingPrayers(false);
      return () => {};
    }

    const q = query(
      collection(db, `driftBottles/${bottle.id}/prayers`)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      prayers.sort((a: any, b: any) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || 0;
        return tB - tA;
      });
      setMyBottlePrayers(prayers);
      setLoadingPrayers(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `driftBottles/${bottle.id}/prayers`);
      setLoadingPrayers(false);
    });

    return unsubscribe;
  };

  return (
    <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] border border-stone-100 p-8 shadow-xl space-y-8">
      
      {/* Header with Title and Anchor */}
      <div className="flex justify-between items-center border-b border-stone-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
            <Waves className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif font-semibold text-lg text-stone-800">主内灵海・漂流瓶</h2>
            <p className="text-[10px] text-stone-400 font-sans tracking-wide">
              {userLatestFeeling ? `AI 已根据您最近「${userLatestFeeling}」的心境为您搜集匹配` : '匿名倾听心碎，用代祷写下主内连接'}
            </p>
          </div>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex bg-stone-100 p-1 rounded-full text-xs">
          <button 
            onClick={() => setActiveTab('sea')}
            className={`px-4 py-1.5 rounded-full font-medium transition-all ${
              activeTab === 'sea' 
                ? 'bg-white text-stone-800 shadow-sm' 
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            漂流海
          </button>
          <button 
            onClick={() => setActiveTab('my-bottles')}
            className={`px-4 py-1.5 rounded-full font-medium transition-all ${
              activeTab === 'my-bottles' 
                ? 'bg-white text-stone-800 shadow-sm' 
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            我的漂流瓶 ({myBottles.length})
          </button>
        </div>
      </div>

      {activeTab === 'sea' ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Casting a bottle section */}
          <div className="md:col-span-5 space-y-6 bg-stone-50/50 p-6 rounded-[2rem] border border-stone-100">
            <div className="space-y-1">
              <span className="text-[9px] font-display font-bold uppercase tracking-widest text-[#d97706]">匿求祷告</span>
              <h3 className="font-serif font-medium text-stone-800">投放匿名漂流瓶</h3>
              <p className="text-xs text-stone-400">将您的挣扎、伤痛或感恩匿名投入大海，让主内弟兄姊妹在爱中与您同行。</p>
            </div>

            <form onSubmit={launchBottle} className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-wider uppercase font-semibold text-stone-400 mb-2">选择心境</label>
                <div className="grid grid-cols-4 gap-2">
                  {moodsList.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMood(m)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedMood === m
                          ? 'bg-amber-100/70 border-amber-300 text-amber-800'
                          : 'bg-white border-stone-100 text-stone-500 hover:border-stone-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase font-semibold text-stone-400 mb-2">心境及期冀 (不含个人姓名)</label>
                <textarea
                  value={bottleContent}
                  onChange={(e) => setBottleContent(e.target.value)}
                  placeholder="例：最近工作家庭面临巨大压力，感到力量有些枯萎，盼求上帝赐下能平静安稳的忍耐力，求兄弟姊妹们为我代祷，谢谢大家..."
                  required
                  maxLength={500}
                  className="w-full h-32 p-4 bg-white border border-stone-200 rounded-xl text-xs text-stone-700 placeholder-stone-300 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLaunching || !bottleContent.trim()}
                className="w-full py-3 bg-stone-900 text-stone-50 rounded-xl font-medium text-xs flex items-center justify-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {isLaunching ? '漂流投放中...' : '密封装瓶・投归灵海'}
              </button>
            </form>

            <AnimatePresence>
              {launchSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-center gap-2 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>漂流瓶已化作流光，匿名隐入茫茫大海...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Incoming drift bottles section */}
          <div className="md:col-span-7 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-serif font-medium text-stone-800">在灵海中漂泊的呼求</h3>
                <p className="text-xs text-stone-400">点击飘到您身旁的求祷信件，为Ta献上只写给上帝的暖心代祷</p>
              </div>
              <button 
                onClick={searchMatchingBottles}
                className="text-[10px] uppercase font-display font-semibold tracking-wider text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                寻航契合
              </button>
            </div>

            <div className="space-y-4">
              {driftBottles.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-stone-200 rounded-[2rem] bg-stone-50/20">
                  <Anchor className="w-8 h-8 mx-auto text-stone-350 mb-3" />
                  <p className="text-stone-400 text-xs font-serif italic">漂泊的海浪正在轻抚，寻找下一个契合的心意...</p>
                </div>
              ) : (
                driftBottles.map((bottle) => (
                  <motion.div
                    key={bottle.id}
                    layoutId={`bottle-${bottle.id}`}
                    onClick={() => {
                        setSelectedBottle(bottle);
                        setModerationError(null);
                        setPrayerText('');
                    }}
                    className="p-5 bg-stone-50 border border-stone-100 rounded-2xl hover:border-amber-200 hover:shadow-md hover:bg-amber-50/10 cursor-pointer transition-all space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full">
                        心境：{bottle.mood}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        已获代祷：{bottle.prayedCount || 0} 次
                      </span>
                    </div>
                    <p className="text-stone-600 text-xs line-clamp-3 leading-relaxed">
                      {bottle.content}
                    </p>
                    <div className="flex justify-end pt-1">
                      <span className="text-[10px] font-display font-medium text-[#d97706] flex items-center gap-1">
                        <Heart className="w-3 h-3 text-[#f43f5e]" />
                        听Ta的诉说，代祷守护
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* My bottles list */
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-serif font-semibold text-stone-800">我投放的漂流瓶</h3>
            <p className="text-xs text-stone-400">查看过往匿名投放的心意，点击卡片来检阅其他兄弟姊妹为您默默守护写下的代祷信。</p>
          </div>

          {myBottles.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-stone-100 rounded-[2.5rem]">
              <Inbox className="w-10 h-10 mx-auto text-stone-200 mb-3" />
              <p className="text-stone-400 font-serif text-sm italic">海面上静悄悄的，还没有放过瓶子呢</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {myBottles.map((bottle) => (
                <div 
                  key={bottle.id}
                  onClick={() => selectMyBottleForPrayers(bottle)}
                  className="p-6 bg-[#faf9f6] border border-stone-100 rounded-2xl space-y-4 hover:border-amber-200 hover:shadow-sm cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="bg-stone-200 text-stone-700 px-2.5 py-1 rounded-full font-bold">
                      心：{bottle.mood}
                    </span>
                    <span className="text-amber-700 font-mono font-bold flex items-center gap-1">
                      <Heart className="w-3 h-3 text-[#f43f5e]" />
                      {bottle.prayedCount || 0} 个守护代祷
                    </span>
                  </div>
                  <p className="text-stone-600 text-xs line-clamp-3 leading-relaxed">
                    {bottle.content}
                  </p>
                  <div className="border-t border-stone-200/50 pt-3 flex justify-between items-center text-[9px] text-stone-400">
                    <span>投放于：{parseDate(bottle.createdAt).toLocaleDateString()}</span>
                    <span className="text-[#d97706] font-medium uppercase font-display tracking-widest">点击检阅信件</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model: 1. Read / Write Prayer on Selected Bottle */}
      <AnimatePresence>
        {selectedBottle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-stone-100 flex flex-col"
            >
              <div className="p-8 bg-amber-50/50 border-b border-stone-100 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] rounded-full font-bold uppercase tracking-wider">匹配飘来的漂流瓶</span>
                  <h3 className="font-serif font-semibold text-stone-800">倾听海那一端的诉求</h3>
                </div>
                <button 
                  onClick={() => setSelectedBottle(null)}
                  className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                <blockquote className="bg-[#faf9f6]/95 border-l-2 border-amber-300 p-5 rounded-r-xl space-y-3">
                  <p className="text-stone-700 text-xs leading-relaxed italic">
                    "{selectedBottle.content}"
                  </p>
                  <footer className="text-[10px] text-stone-400 flex justify-between items-center font-sans">
                    <span>— 匿名求助者 · 状态: {selectedBottle.mood}</span>
                    <span>已守祷: {selectedBottle.prayedCount || 0} 次</span>
                  </footer>
                </blockquote>

                {/* Submit prayer form */}
                <form onSubmit={submitPrayer} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-[10.5px] uppercase tracking-wider font-bold text-stone-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      写下您的守护代祷词 (AI 将会自动审核其真诚意图)
                    </label>
                    <textarea
                      value={prayerText}
                      onChange={(e) => setPrayerText(e.target.value)}
                      placeholder="写下诚挚、温暖、满怀上帝祝福的话语，帮助Ta在困境中感受平静..."
                      required
                      maxLength={1000}
                      className="w-full h-28 p-4 border border-stone-200 rounded-2xl text-xs text-stone-750 focus:outline-none focus:border-amber-400 placeholder-stone-300 resize-none"
                    />
                  </div>

                  {moderationError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{moderationError}</span>
                    </div>
                  )}

                  {prayerSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>祝福代祷成功发送！您的善心已注入Ta的心海。</span>
                    </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBottle(null)}
                      className="flex-1 py-3 border border-stone-200 text-stone-500 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-all cursor-pointer"
                    >
                      放回大海
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingPrayer || !prayerText.trim() || prayerSuccess}
                      className="flex-[2] py-3 bg-stone-900 text-stone-50 rounded-xl text-xs font-semibold hover:bg-stone-850 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Heart className="w-4 h-4 text-[#f43f5e] fill-[#f43f5e]" />
                      {isSubmittingPrayer ? 'AI 契合智审中...' : '审核并奉递守护代祷'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Model: 2. View received prayers on one of MY bottles */}
      <AnimatePresence>
        {selectedMyBottle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-stone-100 flex flex-col h-[550px]"
            >
              <div className="p-8 bg-stone-50 border-b border-stone-100 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 bg-stone-200 text-stone-700 text-[9px] rounded-full font-bold uppercase tracking-wider">漂流回音室</span>
                  <h3 className="font-serif font-semibold text-stone-800">我放出的瓶子的代祷回响</h3>
                </div>
                <button 
                  onClick={() => setSelectedMyBottle(null)}
                  className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 flex-1 overflow-y-auto space-y-6">
                
                {/* Original Bottle context */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-2">
                  <span className="text-[10px] font-sans font-bold text-stone-400">投放的原诉文字：</span>
                  <p className="text-xs text-stone-500 leading-relaxed italic">
                    "{selectedMyBottle.content}"
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-serif font-medium text-stone-800 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                    主内回甘的默默代祷
                  </h4>

                  {loadingPrayers ? (
                    <p className="text-center text-xs text-stone-400 italic">正在寻迹圣民写下的代祷信...</p>
                  ) : myBottlePrayers.length === 0 ? (
                    <div className="text-center p-8 bg-[#faf9f6] rounded-xl border border-dashed border-stone-200">
                      <BookOpen className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                      <p className="text-stone-400 text-xs italic">您的漂流瓶正在浩瀚沧海旅行中，静待远方圣乐与真诚的心愿飘来</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myBottlePrayers.map((prayer) => (
                        <div 
                          key={prayer.id}
                          className="p-5 bg-[#fbfbf9]/60 border border-[#e5e4df]/40 rounded-xl space-y-2 relative"
                        >
                          <div className="flex justify-between items-center text-[9px] text-stone-400">
                            <span className="font-bold text-[#d97706] flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5 text-[#f43f5e] fill-[#f43f5e]" />
                              一位匿名的在主内行者代祷
                            </span>
                            <span>{parseDate(prayer.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-stone-600 leading-relaxed font-serif">
                            {prayer.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-stone-50/50 border-t border-stone-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedMyBottle(null)}
                  className="px-6 py-2 bg-stone-900 text-stone-50 text-xs font-semibold rounded-xl hover:bg-stone-800 transition-all cursor-pointer"
                >
                  愿力量充满
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
