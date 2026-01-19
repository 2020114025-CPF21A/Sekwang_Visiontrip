import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Film, CheckCircle2, Image as ImageIcon, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { upload } from '@vercel/blob/client';

const MAX_FILE_SIZE = 5000 * 1024 * 1024; // 5GB

// Optimization: Lazy Loading Component for Images and Videos
const LazyMedia = ({ memory, onClick }) => {
    const [isInView, setIsInView] = useState(false);
    const mediaRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '200px' }
        );

        if (mediaRef.current) {
            observer.observe(mediaRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const isVideo = memory.url.toLowerCase().match(/\.(mp4|webm|mov)$/);

    return (
        <motion.div
            ref={mediaRef}
            className="archive-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => isInView && onClick(memory)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
        >
            {!isInView ? (
                <div className="archive-skeleton-static" />
            ) : (
                <>
                    {isVideo ? (
                        <div className="archive-video-wrapper">
                            <video
                                src={memory.url}
                                muted
                                playsInline
                                preload="none"
                                onMouseEnter={e => e.target.play()}
                                onMouseLeave={e => {
                                    e.target.pause();
                                    e.target.currentTime = 0;
                                }}
                            />
                            <div className="video-icon-tag"><Film size={12} /></div>
                        </div>
                    ) : (
                        <img
                            src={memory.url}
                            alt="Memory"
                            loading="lazy"
                            decoding="async"
                        />
                    )}
                </>
            )}
        </motion.div>
    );
};

// Modal for Detailed View
const MemoryModal = ({ memory, onClose }) => {
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [mediaUrl, setMediaUrl] = useState(null);

    useEffect(() => {
        if (!memory) return;

        const loadMedia = async () => {
            setIsLoading(true);
            setLoadingProgress(0);
            try {
                const response = await fetch(memory.url);
                const reader = response.body.getReader();
                const contentLength = +response.headers.get('Content-Length');

                let receivedLength = 0;
                let chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;
                    if (contentLength) {
                        setLoadingProgress(Math.round((receivedLength / contentLength) * 100));
                    }
                }

                const blob = new Blob(chunks);
                const url = URL.createObjectURL(blob);
                setMediaUrl(url);
            } catch (error) {
                console.error('Failed to load media:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadMedia();

        return () => {
            if (mediaUrl) URL.revokeObjectURL(mediaUrl);
        };
    }, [memory]);

    if (!memory) return null;

    const isVideo = memory.url.toLowerCase().match(/\.(mp4|webm|mov)$/);

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = mediaUrl || memory.url;
        a.download = memory.pathname.split('/').pop() || 'memory-sekwang';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="modal-content"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={e => e.stopPropagation()}
            >
                <button className="modal-close" onClick={onClose}><X size={24} /></button>

                <div className="modal-media-container">
                    {isLoading ? (
                        <div className="media-loader-overlay">
                            <div className="loader-circle-container">
                                <svg viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" className="loader-bg" />
                                    <circle
                                        cx="50" cy="50" r="45"
                                        className="loader-fill"
                                        style={{ strokeDasharray: 283, strokeDashoffset: 283 - (283 * loadingProgress) / 100 }}
                                    />
                                </svg>
                                <div className="loader-percentage">{loadingProgress}%</div>
                            </div>
                            <p>미디어를 불러오는 중입니다...</p>
                        </div>
                    ) : (
                        isVideo ? (
                            <video src={mediaUrl} controls autoPlay playsInline />
                        ) : (
                            <img src={mediaUrl} alt="Full view" />
                        )
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-download-full" onClick={handleDownload} disabled={isLoading}>
                        <Download size={18} /> 원본 저장하기
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

function App() {
    const [activeTab, setActiveTab] = useState('archive');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [globalError, setGlobalError] = useState(null);
    const [memories, setMemories] = useState([]);
    const [currentMemoryIndex, setCurrentMemoryIndex] = useState(0);
    const [loadingMemories, setLoadingMemories] = useState(true);
    const [selectedMemory, setSelectedMemory] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 12; // 3 columns * 4 rows

    const [fileStatuses, setFileStatuses] = useState({});
    const fileInputRef = useRef(null);

    // Fetch existing memories from Vercel Blob
    useEffect(() => {
        fetchMemories();
    }, []);

    const fetchMemories = async () => {
        setLoadingMemories(true);
        try {
            const response = await fetch('/api/list');
            const data = await response.json();
            if (Array.isArray(data)) {
                // Shuffle memories for randomness
                const shuffled = [...data].sort(() => Math.random() - 0.5);
                setMemories(shuffled);
            }
        } catch (err) {
            console.error('Failed to fetch memories:', err);
        } finally {
            setLoadingMemories(false);
        }
    };

    // Auto-rotate slideshow
    useEffect(() => {
        if (memories.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentMemoryIndex((prev) => (prev + 1) % memories.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [memories]);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);

        const tooLarge = selectedFiles.some(file => file.size > MAX_FILE_SIZE);
        if (tooLarge) {
            alert('파일 하나당 최대 5GB까지 업로드 가능합니다.');
            return;
        }

        const newFiles = selectedFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: URL.createObjectURL(file),
            file: file,
            rawType: file.type,
            size: file.size
        }));

        setFiles(prev => [...prev, ...newFiles]);

        const newStatuses = {};
        newFiles.forEach(f => {
            newStatuses[f.id] = { progress: 0, status: 'pending' };
        });
        setFileStatuses(prev => ({ ...prev, ...newStatuses }));
    };

    const removeFile = (id) => {
        setFiles(prev => {
            const filtered = prev.filter(f => f.id !== id);
            const removed = prev.find(f => f.id === id);
            if (removed) URL.revokeObjectURL(removed.url);
            return filtered;
        });
        setFileStatuses(prev => {
            const { [id]: removed, ...rest } = prev;
            return rest;
        });
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setGlobalError(null);

        try {
            for (let i = 0; i < files.length; i++) {
                const fileData = files[i];

                setFileStatuses(prev => ({
                    ...prev,
                    [fileData.id]: { ...prev[fileData.id], status: 'uploading' }
                }));

                try {
                    // addRandomSuffix는 서버 사이드(api/upload.js) 설정으로 이동했습니다.
                    await upload(fileData.name, fileData.file, {
                        access: 'public',
                        handleUploadUrl: '/api/upload',
                        onUploadProgress: (progressEvent) => {
                            const currentProgress = progressEvent.percentage;
                            setFileStatuses(prev => ({
                                ...prev,
                                [fileData.id]: { ...prev[fileData.id], progress: currentProgress }
                            }));
                        },
                    });

                    setFileStatuses(prev => ({
                        ...prev,
                        [fileData.id]: { progress: 100, status: 'completed' }
                    }));
                } catch (err) {
                    console.error(`Upload failed for ${fileData.name}:`, err);
                    setFileStatuses(prev => ({
                        ...prev,
                        [fileData.id]: { ...prev[fileData.id], status: 'error' }
                    }));
                    // Keep going with other files if one fails, but track error
                }
            }

            setTimeout(() => {
                setUploading(false);
                setCompleted(true);
                fetchMemories(); // Refresh the list after upload
            }, 800);

        } catch (error) {
            setUploading(false);
            setGlobalError(error.message || '업로드 중 예상치 못한 오류가 발생했습니다.');
        }
    };

    const reset = () => {
        files.forEach(f => URL.revokeObjectURL(f.url));
        setFiles([]);
        setCompleted(false);
        setGlobalError(null);
        setFileStatuses({});
    };

    const totalFiles = files.length;
    const completedCount = Object.values(fileStatuses).filter(s => s.status === 'completed').length;
    const totalProgressSum = Object.values(fileStatuses).reduce((acc, curr) => acc + curr.progress, 0);
    const averageProgress = totalFiles > 0 ? Math.round(totalProgressSum / totalFiles) : 0;

    return (
        <div className="container">
            <header className="header">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="logo-container"
                >
                    <img src="/SekwangLogo.png" alt="Sekwang Logo" className="site-logo" />
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    세광 비전트립
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    우리들의 소중한 추억 저장소
                </motion.p>
            </header>

            <nav className="tab-nav">
                <button
                    className={activeTab === 'archive' ? 'active' : ''}
                    onClick={() => setActiveTab('archive')}
                >
                    추억 아카이브
                </button>
                <button
                    className={activeTab === 'upload' ? 'active' : ''}
                    onClick={() => setActiveTab('upload')}
                >
                    추억 업로드
                </button>
            </nav>

            <main>
                {activeTab === 'archive' ? (
                    <section className="archive-section">
                        {/* Highlights Slideshow */}
                        <div className="slideshow-container-mini">
                            <AnimatePresence mode="wait">
                                {loadingMemories ? (
                                    <div className="slideshow-placeholder">
                                        <Loader2 className="animate-spin" size={24} />
                                    </div>
                                ) : memories.length > 0 ? (
                                    <motion.div
                                        key={memories[currentMemoryIndex].url}
                                        className="slideshow-item-mini"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1 }}
                                    >
                                        {memories[currentMemoryIndex].url.toLowerCase().match(/\.(mp4|webm|mov)$/) ? (
                                            <video src={memories[currentMemoryIndex].url} autoPlay muted loop playsInline />
                                        ) : (
                                            <img src={memories[currentMemoryIndex].url} alt="Highlight" />
                                        )}
                                        <div className="slideshow-label-mini">Highlights</div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>

                        <div className="archive-grid">
                            {loadingMemories ? (
                                Array(6).fill(0).map((_, i) => (
                                    <div key={i} className="archive-skeleton" />
                                ))
                            ) : memories.length > 0 ? (
                                memories
                                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                    .map((memory) => (
                                        <LazyMedia
                                            key={memory.url}
                                            memory={memory}
                                            onClick={setSelectedMemory}
                                        />
                                    ))
                            ) : (
                                <div className="empty-archive">
                                    <p>아직 저장된 추억이 없습니다.</p>
                                    <button onClick={() => setActiveTab('upload')}>첫 추억 업로드하기</button>
                                </div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {!loadingMemories && memories.length > ITEMS_PER_PAGE && (
                            <div className="pagination">
                                <button
                                    className="page-nav-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(1)}
                                >
                                    <ChevronsLeft size={16} />
                                </button>
                                <button
                                    className="page-nav-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <div className="page-numbers">
                                    {Array.from({ length: Math.ceil(memories.length / ITEMS_PER_PAGE) }).map((_, i) => {
                                        const pageNum = i + 1;
                                        const totalPages = Math.ceil(memories.length / ITEMS_PER_PAGE);
                                        if (
                                            totalPages > 5 &&
                                            pageNum !== 1 &&
                                            pageNum !== totalPages &&
                                            Math.abs(pageNum - currentPage) > 1
                                        ) {
                                            if (Math.abs(pageNum - currentPage) === 2) return <span key={pageNum} className="pagination-ellipsis">...</span>;
                                            return null;
                                        }

                                        return (
                                            <button
                                                key={pageNum}
                                                className={`page-num ${currentPage === pageNum ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    className="page-nav-btn"
                                    disabled={currentPage === Math.ceil(memories.length / ITEMS_PER_PAGE)}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    className="page-nav-btn"
                                    disabled={currentPage === Math.ceil(memories.length / ITEMS_PER_PAGE)}
                                    onClick={() => setCurrentPage(Math.ceil(memories.length / ITEMS_PER_PAGE))}
                                >
                                    <ChevronsRight size={16} />
                                </button>
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="upload-section">
                        {files.length === 0 ? (
                            <motion.div
                                className="upload-card"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                            >
                                <div className="upload-icon-wrapper">
                                    <Upload size={32} />
                                </div>
                                <div>
                                    <h3>새로운 추억 업로드</h3>
                                    <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                        사진이나 영상을 선택해 주세요. (최대 5GB)
                                    </p>
                                </div>
                                <button
                                    className="btn-upload"
                                    onClick={() => fileInputRef.current.click()}
                                >
                                    파일 선택하기
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    multiple
                                    accept="image/*,video/*"
                                    style={{ display: 'none' }}
                                />
                            </motion.div>
                        ) : (
                            <div style={{ paddingBottom: '120px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                    <h3 style={{ fontWeight: 600 }}>선택된 파일 ({files.length}개)</h3>
                                    {!uploading && (
                                        <button
                                            onClick={() => fileInputRef.current.click()}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--primary)',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            + 더 추가하기
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        multiple
                                        accept="image/*,video/*"
                                        style={{ display: 'none' }}
                                    />
                                </div>

                                <div className="preview-grid">
                                    <AnimatePresence>
                                        {files.map((file) => (
                                            <motion.div
                                                key={file.id}
                                                className="preview-item"
                                                layout
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                            >
                                                {file.type === 'image' ? (
                                                    <img src={file.url} alt={file.name} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Film size={32} color="white" />
                                                    </div>
                                                )}

                                                {file.type === 'video' && <div className="video-badge"><Film size={12} style={{ marginRight: 4 }} /> Video</div>}

                                                {!uploading && (
                                                    <button className="btn-remove" onClick={() => removeFile(file.id)}>
                                                        <X size={14} />
                                                    </button>
                                                )}

                                                {fileStatuses[file.id]?.status === 'uploading' && (
                                                    <div className="item-progress-wrapper">
                                                        <div
                                                            className="item-progress-bar"
                                                            style={{ width: `${fileStatuses[file.id].progress}%` }}
                                                        ></div>
                                                    </div>
                                                )}
                                                {fileStatuses[file.id]?.status === 'completed' && (
                                                    <div className="item-status-overlay">
                                                        <CheckCircle2 size={24} color="#10b981" />
                                                    </div>
                                                )}
                                                {fileStatuses[file.id]?.status === 'error' && (
                                                    <div className="item-status-overlay" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                                                        <AlertCircle size={24} color="#ef4444" />
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {activeTab === 'upload' && files.length > 0 && !completed && !uploading && (
                <div className="footer-actions">
                    <button className="btn-submit" onClick={handleUpload}>
                        {files.length}개의 파일 업로드
                    </button>
                </div>
            )}

            <AnimatePresence>
                {selectedMemory && (
                    <MemoryModal
                        memory={selectedMemory}
                        onClose={() => setSelectedMemory(null)}
                    />
                )}

                {uploading && (
                    <motion.div
                        className="progress-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="progress-card">
                            <div className="spinner-container" style={{ marginBottom: '1.5rem' }}>
                                <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)', margin: '0 auto' }} />
                            </div>
                            <h3 style={{ marginBottom: '1rem' }}>파일 업로드 중</h3>

                            <div className="progress-bar-bg">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${averageProgress}%` }}
                                ></div>
                            </div>

                            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                전체 진행률: {averageProgress}% ({completedCount} / {totalFiles})
                            </p>
                            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                파일이 많으면 오래 걸릴 수도 있습니다.
                            </p>
                        </div>
                    </motion.div>
                )}

                {completed && (
                    <motion.div
                        className="progress-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="progress-card">
                            <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                            <h3>업로드 완료!</h3>
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
                                모든 파일이 성공적으로 전송되었습니다.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
                                <button
                                    className="btn-upload"
                                    onClick={reset}
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {globalError && (
                    <motion.div
                        className="progress-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="progress-card">
                            <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
                            <h3>업로드 실패</h3>
                            <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                {globalError}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
                                <button
                                    className="btn-upload"
                                    style={{ background: '#ef4444' }}
                                    onClick={() => setGlobalError(null)}
                                >
                                    다시 시도
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default App;
