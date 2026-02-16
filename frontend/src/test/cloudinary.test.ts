import { describe, it, expect } from "vitest";
import { getCloudinaryDownloadUrl } from "../lib/cloudinary";

describe("getCloudinaryDownloadUrl", () => {
    it("should add fl_attachment to image URLs", () => {
        const input = "https://res.cloudinary.com/demo/image/upload/v123/sample.jpg";
        const expected = "https://res.cloudinary.com/demo/image/upload/fl_attachment/v123/sample.jpg";
        expect(getCloudinaryDownloadUrl(input)).toBe(expected);
    });

    it("should add fl_attachment AND dn to image URLs when filename is provided", () => {
        const input = "https://res.cloudinary.com/demo/image/upload/v123/sample.jpg";
        const filename = "my_cool_image.jpg";
        const expected = "https://res.cloudinary.com/demo/image/upload/fl_attachment,dn_my_cool_image.jpg/v123/sample.jpg";
        expect(getCloudinaryDownloadUrl(input, filename)).toBe(expected);
    });

    it("should NOT use SEO URL pattern for raw URLs (preventing 404)", () => {
        const input = "https://res.cloudinary.com/demo/raw/upload/v123/hashed_name";
        const filename = "report.zip";
        expect(getCloudinaryDownloadUrl(input, filename)).toBe(input);
    });

    it("should return original URL for raw files without filename", () => {
        const input = "https://res.cloudinary.com/demo/raw/upload/v123/sample.zip";
        expect(getCloudinaryDownloadUrl(input)).toBe(input);
    });

    it("should NOT modify non-Cloudinary URLs", () => {
        const input = "https://example.com/files/sample.zip";
        expect(getCloudinaryDownloadUrl(input)).toBe(input);
    });

    it("should return empty string for undefined input", () => {
        expect(getCloudinaryDownloadUrl(undefined)).toBe("");
    });
});
