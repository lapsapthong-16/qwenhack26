import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count >= 4 else {
  fputs("usage: frames-to-mov.swift output.mov frame1.png frame2.png ...\n", stderr)
  exit(2)
}

let outputURL = URL(fileURLWithPath: args[1])
let frameURLs = args.dropFirst(2).map { URL(fileURLWithPath: $0) }

func loadImage(_ url: URL) -> CGImage {
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    fatalError("Cannot read image: \(url.path)")
  }
  return image
}

try? FileManager.default.removeItem(at: outputURL)

let first = loadImage(frameURLs[0])
let size = CGSize(width: first.width, height: first.height)
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: first.width,
  AVVideoHeightKey: first.height,
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: first.width,
  kCVPixelBufferHeightKey as String: first.height,
])

guard writer.canAdd(input) else { fatalError("Cannot add video input") }
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let frameDuration = CMTime(value: 13, timescale: 20)
let colorSpace = CGColorSpaceCreateDeviceRGB()

func pixelBuffer(for image: CGImage) -> CVPixelBuffer {
  var buffer: CVPixelBuffer?
  CVPixelBufferCreate(kCFAllocatorDefault, Int(size.width), Int(size.height), kCVPixelFormatType_32ARGB, nil, &buffer)
  guard let buffer else { fatalError("Cannot allocate pixel buffer") }
  CVPixelBufferLockBaseAddress(buffer, [])
  let context = CGContext(
    data: CVPixelBufferGetBaseAddress(buffer),
    width: Int(size.width),
    height: Int(size.height),
    bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
  )
  context?.draw(image, in: CGRect(origin: .zero, size: size))
  CVPixelBufferUnlockBaseAddress(buffer, [])
  return buffer
}

for (index, url) in frameURLs.enumerated() {
  while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.02) }
  let time = CMTimeMultiply(frameDuration, multiplier: Int32(index))
  adaptor.append(pixelBuffer(for: loadImage(url)), withPresentationTime: time)
}

input.markAsFinished()
writer.finishWriting {
  if let error = writer.error {
    fputs("\(error)\n", stderr)
    exit(1)
  }
  print(outputURL.path)
  exit(0)
}

RunLoop.main.run()
