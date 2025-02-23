import { useState } from 'react';
import styles from '../styles/MergeTest.module.css';

export default function MergeTest() {
  const [videoUrls, setVideoUrls] = useState(['', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mergedVideo, setMergedVideo] = useState<{
    mergedVideoUrl: string;
    mergedPath: string;
  } | null>(null);

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  };

  const handleAddUrl = () => {
    if (videoUrls.length < 4) {
      setVideoUrls([...videoUrls, '']);
    }
  };

  const handleRemoveUrl = (index: number) => {
    if (videoUrls.length > 2) {
      const newUrls = videoUrls.filter((_, i) => i !== index);
      setVideoUrls(newUrls);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMergedVideo(null);

    try {
      // Filter out empty URLs
      const validUrls = videoUrls.filter(url => url.trim() !== '');

      const response = await fetch('/api/merge-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrls: validUrls }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to merge videos');
      }

      setMergedVideo({
        mergedVideoUrl: data.mergedVideoUrl,
        mergedPath: data.mergedPath,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while merging videos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Video Merge Test</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.urlInputs}>
          {videoUrls.map((url, index) => (
            <div key={index} className={styles.inputGroup}>
              <input
                type="text"
                placeholder={`Video URL ${index + 1}`}
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                disabled={isLoading}
                className={styles.input}
              />
              {videoUrls.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(index)}
                  disabled={isLoading}
                  className={styles.removeButton}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {videoUrls.length < 4 && (
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={isLoading}
              className={styles.secondaryButton}
            >
              Add Another URL ({videoUrls.length}/4)
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || videoUrls.filter(url => url.trim() !== '').length < 2}
          className={styles.primaryButton}
        >
          {isLoading ? 'Merging...' : 'Merge Videos'}
        </button>
      </form>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {mergedVideo && (
        <div className={styles.result}>
          <h2>Merged Video Result</h2>
          <div className={styles.success}>
            Videos merged successfully!
          </div>
          <div className={styles.videoContainer}>
            <video
              controls
              src={mergedVideo.mergedVideoUrl}
              className={styles.video}
            />
          </div>
          <p className={styles.path}>
            Merged Path: {mergedVideo.mergedPath}
          </p>
        </div>
      )}
    </div>
  );
}
