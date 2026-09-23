import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Trash2, 
  Send, 
  MessageSquare, 
  Clock, 
  Download, 
  Quote, 
  Calendar,
  Sparkles,
  Heart,
  ChevronDown
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  orderBy, 
  query, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { toPng } from 'html-to-image';
import { cn } from '../lib/utils';

interface ReflectionDetailModalProps {
  item: any;
  onClose: () => void;
  uid: string;
  onDeleteReflection: (id: string) => Promise<void>;
}

const MONTHS_ZH = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const MONTHS_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export default function ReflectionDetailModal({ 
  item, 
  onClose, 
  uid,
  onDeleteReflection
}: ReflectionDetailModalProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);
  const section3Ref = useRef<HTMLDivElement>(null);
  const wallpaperRef = useRef<HTMLDivElement>(null);

  // Time & date calculations
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
  const day = dateObj.getDate();
  const monthZh = MONTHS_ZH[monthIdx];
  const monthEn = MONTHS_EN[monthIdx];

  // Load comments
  useEffect(() => {
    if (!item.id || !uid) return;
    setLoadingComments(true);
    const commentsColRef = collection(db, `users/${uid}/reflections/${item.id}/comments`);
    const q = query(commentsColRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
      setLoadingComments(false);
    }, (error) => {
      console.error("Error loading comments:", error);
      setLoadingComments(false);
    });

    return unsubscribe;
  }, [item.id, uid]);

  // Handle adding a retrospective comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !uid || !item.id) return;

    try {
      const commentsColRef = collection(db, `users/${uid}/reflections/${item.id}/comments`);
      await addDoc(commentsColRef, {
        userId: uid,
        content: newComment.trim(),
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  // Handle individual comment delete
  const handleDeleteComment = async (commentId: string) => {
    if (!uid || !item.id) return;
    try {
      await deleteDoc(doc(db, `users/${uid}/reflections/${item.id}/comments`, commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  // Scroll to section helper
  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    if (sectionRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetOffset = sectionRef.current.offsetTop;
      container.scrollTo({
        top: targetOffset - container.offsetTop,
        behavior: 'smooth'
      });
    }
  };

  // Download Gregorian Calendar Wallpaper
  const handleDownloadWallpaper = async () => {
    if (!wallpaperRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(wallpaperRef.current, {
        cacheBust: true,
        quality: 1,
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `ScriptureBloom-Wallpaper-${year}.${monthIdx + 1}.${day}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generating wallpaper image:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const fallbackBg = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1000';
  const wallpaperBg = item.backgroundImageUrl || fallbackBg;

  // Format single comment date
  const formatCommentTime = (createdAtAny: any) => {
    if (!createdAtAny) return '刚刚';
    const d = createdAtAny.toDate ? createdAtAny.toDate() : new Date(createdAtAny);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-stone-900/40 backdrop-blur-3xl"
    >
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />
      
      {/* Scrollbar-hiding CSS injected dynamically */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-2xl bg-stone-50 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden max-h-[90vh] z-10 border border-stone-100 flex flex-col"
      >
        {/* Fixed Floating Header close button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[220] w-12 h-12 bg-white/90 hover:bg-white border border-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:border-stone-300 transition-all shadow-md cursor-pointer"
          title="关闭心迹"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container with Hidden Scrollbar */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-8 sm:p-14 relative"
        >
          {/* Section 1: 一开始的心情 */}
          <div 
            ref={section1Ref}
            className="min-h-[55vh] flex flex-col justify-center items-center py-12 relative text-center"
          >
            <div className="space-y-6 my-auto">
              <span className="text-[9px] font-mono tracking-[0.4em] text-[#9d3c30] block font-extrabold uppercase">
                昔日心迹之始
              </span>
              <div className="w-8 h-px bg-[#9d3c30]/20 mx-auto" />
              <div className="space-y-4 max-w-lg px-4">
                <p className="text-2xl sm:text-3xl text-stone-850 font-serif italic leading-relaxed whitespace-pre-wrap font-medium">
                  “ {item.content} ”
                </p>
              </div>
              <div className="pt-4 flex items-center justify-center gap-2 text-stone-400 text-xs">
                <Calendar className="w-3.5 h-3.5 text-stone-300" />
                <span>当时心情记于 {year}年{monthZh}{day}日</span>
              </div>
            </div>

            {/* Scroll Down Hint Button */}
            <button 
              onClick={() => scrollToSection(section2Ref)}
              className="absolute bottom-4 p-3 rounded-full bg-stone-100/60 hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-all cursor-pointer animate-bounce shrink-0"
              title="向上滑动或点击查看当时经文"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Section 2: 静默的经文 (Card View) */}
          <div 
            ref={section2Ref}
            className="min-h-[75vh] flex flex-col justify-center items-center py-12 relative border-t border-stone-100/50"
          >
            <div className="text-center mb-8 my-auto">
              <span className="text-[9px] font-mono tracking-[0.4em] text-stone-400 block font-bold uppercase">
                当时受领圣言卡片
              </span>
            </div>

            {/* Phone Wallpaper Mockup */}
            <div className="flex flex-col items-center space-y-8 w-full max-w-sm">
              <div 
                ref={wallpaperRef}
                id="gregorian-wallpaper-capture"
                className="aspect-[9/16] w-full max-w-[280px] md:max-w-[310px] relative rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white select-none mx-auto bg-stone-150"
              >
                <img 
                  src={wallpaperBg} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/35 backdrop-blur-[0.4px] pointer-events-none" />
                
                {/* Simplified Calendar Typography Header - "上面的两行字可以去掉" */}
                <div className="absolute top-12 left-0 right-0 text-center text-white pointer-events-none px-6">
                  <div className="space-y-0.5">
                    <h4 className="text-2xl font-serif tracking-[0.1em] font-light mt-1">
                      {monthZh} {day}日
                    </h4>
                    <p className="text-[8px] tracking-[0.2em] font-mono opacity-50 leading-none">
                      {monthEn} {day}
                    </p>
                  </div>
                </div>

                {/* Middle: Content Scripture Scripture */}
                <div className="absolute inset-0 p-8 flex flex-col justify-center text-white text-center pointer-events-none">
                  <Quote className="w-6 h-6 opacity-25 mb-4 mx-auto" />
                  <div className="space-y-5 font-serif">
                    <p className="text-lg md:text-xl font-light leading-[1.6] tracking-wide drop-shadow-xl select-none">
                      {item.verseText}
                    </p>
                    {item.verseTextEn && (
                      <>
                        <div className="h-px w-6 bg-white/25 mx-auto" />
                        <p className="text-[11px] font-light leading-relaxed opacity-75 drop-shadow-sm px-1 italic">
                          {item.verseTextEn}
                        </p>
                      </>
                    )}
                    <p className="pt-2 text-[8px] tracking-[0.3em] font-sans uppercase opacity-50 block">
                      — {item.verseId || "经文"} —
                    </p>
                  </div>
                </div>

                {/* Bottom Brand */}
                <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                  <span className="text-[8px] tracking-[0.4em] font-sans uppercase opacity-35 text-white">ScriptureBloom</span>
                </div>
              </div>

              {/* Download Action Trigger */}
              <button
                onClick={handleDownloadWallpaper}
                disabled={isDownloading}
                className="px-6 py-3.5 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-full text-xs font-display font-semibold tracking-wider uppercase flex items-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-55 cursor-pointer"
              >
                <Download className={cn("w-3.5 h-3.5", isDownloading ? "animate-bounce" : "")} />
                {isDownloading ? "生成壁纸中..." : "保存此日壁纸"}
              </button>
            </div>

            {/* Scroll Down Hint Button */}
            <button 
              onClick={() => scrollToSection(section3Ref)}
              className="absolute bottom-4 p-3 rounded-full bg-stone-100/60 hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-all cursor-pointer animate-bounce shrink-0"
              title="向上滑动或点击查看静心思悟"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Section 3: 静思悟得与追笔回响 */}
          <div 
            ref={section3Ref}
            className="pt-12 space-y-10 border-t border-stone-100/50"
          >
            <div className="text-center">
              <span className="text-[9px] font-mono tracking-[0.4em] text-[#d97706] block font-extrabold uppercase">
                昔日静心悟得
              </span>
            </div>

            {/* Devotional Insights */}
            {item.insight ? (
              <div className="space-y-4 bg-amber-50/25 border border-amber-100/20 p-8 rounded-[2rem] text-center max-w-xl mx-auto shadow-sm">
                <div className="flex items-center justify-center gap-2 text-amber-600 mb-1">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest leading-none">静默灵修所悟</span>
                </div>
                <p className="text-stone-750 font-serif italic text-lg leading-relaxed whitespace-pre-wrap max-w-lg mx-auto">
                  {item.insight}
                </p>
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-stone-200 rounded-[2rem] max-w-xl mx-auto">
                <p className="text-stone-300 font-serif italic text-sm">当时灵修静默，无言而得，万籁寂静</p>
              </div>
            )}

            {/* Timeline & comments retrospective list */}
            <div className="space-y-5 pt-8 border-t border-stone-100">
              <h3 className="text-xs font-display font-bold uppercase tracking-widest text-stone-500 flex items-center justify-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                往昔回响 — 岁月重温记
              </h3>
              
              <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar no-scrollbar max-w-xl mx-auto">
                {comments.length === 0 ? (
                  <p className="text-stone-300 text-xs font-serif italic text-center py-4">
                    岁月变迁，你还未曾留下重温感悟。在下方写下今日的追笔吧。
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className="group flex flex-col gap-1.5 p-4 bg-stone-50 rounded-2xl border border-stone-100/60 relative"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-stone-400">
                          <Clock className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-mono uppercase tracking-wider">
                            {formatCommentTime(comment.createdAt)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="w-5 h-5 rounded flex items-center justify-center text-stone-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          title="删除回响"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-stone-700 text-sm font-serif italic leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Interactive Comments Form */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-stone-100 max-w-xl mx-auto">
              <div className="relative flex items-center bg-stone-50 rounded-full border border-stone-100 focus-within:border-stone-300 focus-within:bg-white transition-all px-4 py-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="多年后再读此言，留下你今日的追笔..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-stone-800 placeholder:text-stone-300 font-serif text-sm resize-none h-9 max-h-9 flex items-center outline-none py-1.5 leading-relaxed focus-visible:ring-0 focus-visible:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="w-9 h-9 bg-stone-900 hover:bg-stone-800 text-stone-50 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </form>
            
            {/* Action Trigger Block */}
            <div className="pt-4 border-t border-stone-100 max-w-xl mx-auto">
              <button
                onClick={async () => {
                  if (confirm("确定要永久封存并删除这条宝贵的心迹吗？数据一旦抹去不可找回。")) {
                    await onDeleteReflection(item.id);
                    onClose();
                  }
                }}
                className="text-stone-300 hover:text-rose-600 text-[9px] tracking-widest font-display font-semibold uppercase text-center transition-colors hover:scale-105 mx-auto block cursor-pointer"
              >
                彻底封除此心迹
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
