import React, { useState } from 'react';
import { X, Music2 } from 'lucide-react';

interface NewPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, description?: string) => void;
}

export const NewPlaylistModal: React.FC<NewPlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), description.trim());
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h3 className="text-base font-semibold">New Playlist</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="w-24 h-24 mx-auto rounded-2xl bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-rose-400 shadow-inner">
            <Music2 className="w-10 h-10" />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Playlist Name
            </label>
            <input
              type="text"
              autoFocus
              placeholder="My Favorite Mix"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-neutral-800/90 border border-neutral-700/80 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Late night songs, summer vibes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700/80 text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 text-sm resize-none"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 font-medium text-sm text-neutral-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 font-semibold text-sm text-white transition shadow-lg shadow-rose-900/30"
            >
              Create
            </button>
          </div>

          <div className="relative flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <span className="relative px-2 bg-neutral-900 text-[10px] text-neutral-500 font-medium uppercase tracking-wider">Or</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('celestial-open-spotify-import'));
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/30 text-[#1DB954] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.306c-.216.353-.674.467-1.027.252-2.815-1.72-6.358-2.109-10.533-1.155-.403.092-.803-.16-.895-.563-.092-.403.16-.803.563-.895 4.57-1.045 8.492-.601 11.64 1.334.353.216.467.674.252 1.027zm1.467-3.26c-.272.443-.849.585-1.292.313-3.223-1.981-8.136-2.553-11.948-1.396-.5.152-1.031-.133-1.183-.633-.152-.5.133-1.031.633-1.183 4.358-1.323 9.776-.684 13.477 1.591.443.272.585.849.313 1.292zm.126-3.41c-3.864-2.294-10.245-2.506-13.935-1.385-.593.18-1.222-.158-1.402-.751-.18-.593.158-1.222.751-1.402 4.24-1.287 11.285-1.038 15.727 1.598.533.316.708 1.008.392 1.541-.316.533-1.008.708-1.533.399z" />
            </svg>
            Import from Spotify
          </button>
        </form>
      </div>
    </div>
  );
};
