import React, { useState, useRef } from 'react';
import { Upload, X, Film, CheckCircle2, Image as ImageIcon, Loader2, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { upload } from '@vercel/blob/client';

const MAX_FILE_SIZE = 5000 * 1024 * 1024; // 5GB

function App() {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [globalError, setGlobalError] = useState(null);

    const [fileStatuses, setFileStatuses] = useState({});
    const fileInputRef = useRef(null);

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
                    throw new Error(`${fileData.name} 업로드 실패: ${err.message}`);
                }
            }

            setTimeout(() => {
                setUploading(false);
                setCompleted(true);
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
                    우리들의 소중한 추억을 공유해 주세요
                </motion.p>
            </header>

            <main>
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
                            <h3>사진 및 영상 선택</h3>
                            <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                파일당 최대 5GB까지 업로드할 수 있습니다.
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
            </main>

            {files.length > 0 && !completed && !uploading && (
                <div className="footer-actions">
                    <button className="btn-submit" onClick={handleUpload}>
                        {files.length}개의 파일 업로드
                    </button>
                </div>
            )}

            <AnimatePresence>
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