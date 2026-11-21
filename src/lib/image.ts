/**
 * リモート画像をビルド時に取得して WebP に変換する。
 * 取得に失敗した画像は undefined を返し、呼び出し側で画像なしとして扱う。
 */
import { getImage } from 'astro:assets';

export interface OptimizedImage {
  src: string;
  srcset?: string;
  width: number;
  height: number;
}

type ImageOptions = { widths?: number[]; width?: number };

const RETRY_DELAY_MS = 2_000;

async function tryGetImage(src: string, options: ImageOptions): Promise<OptimizedImage> {
  const image = await getImage({ src, inferSize: true, format: 'webp', ...options });
  return {
    src: image.src,
    srcset: image.srcSet.attribute || undefined,
    width: Number(image.attributes.width),
    height: Number(image.attributes.height),
  };
}

export async function optimizeRemoteImage(src: string, options: ImageOptions = {}): Promise<OptimizedImage | undefined> {
  try {
    return await tryGetImage(src, options);
  } catch {
    // 画像サーバーが一時的に 429 などを返すことがあるので、少し待って 1 回だけやり直す
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return await tryGetImage(src, options);
    } catch (error) {
      console.warn(`[image] ${src}: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  }
}

/** 同じ画像サーバーへ一度に大量に問い合わせないよう、1 件ずつ順番に処理する */
export async function mapSequential<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (const [index, item] of items.entries()) results.push(await fn(item, index));
  return results;
}
