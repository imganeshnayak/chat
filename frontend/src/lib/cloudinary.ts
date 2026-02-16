/**
 * Helper to generate a Cloudinary download URL with the fl_attachment transformation.
 */
export function getCloudinaryDownloadUrl(url: string | undefined, filename?: string): string {
    if (!url) return "";
    if (!url.includes("cloudinary.com")) return url;

    // For raw files, we return original URL to avoid 404s
    if (url.includes("/raw/upload/")) {
        return url;
    }

    // Use fl_attachment for images/videos
    if (url.includes("/image/upload/") || url.includes("/video/upload/")) {
        let transformation = "fl_attachment";
        if (filename) {
            transformation += `,dn_${encodeURIComponent(filename)}`;
        }
        return url.replace("/upload/", `/upload/${transformation}/`);
    }

    return url;
}

/**
 * Robustly downloads a file by fetching it as a blob.
 * This bypasses cross-origin 'download' attribute restrictions and ensures
 * the file is saved with the provided filename and extension.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error("Failed to download file:", err);
        // Fallback: Try opening in a new tab if fetch fails
        window.open(url, "_blank");
    }
}
