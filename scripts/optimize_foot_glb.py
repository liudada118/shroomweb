from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

import numpy as np


def load_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError(f"Invalid GLB header: {path}")

    offset = 12
    json_chunk = None
    bin_chunk = None

    while offset < length:
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk_data = data[offset : offset + chunk_length]
        offset += chunk_length

        if chunk_type == 0x4E4F534A:
            json_chunk = json.loads(chunk_data.decode("utf-8"))
        elif chunk_type == 0x004E4942:
            bin_chunk = chunk_data

    if json_chunk is None or bin_chunk is None:
        raise ValueError(f"Missing JSON or BIN chunk: {path}")

    return json_chunk, bin_chunk


def extract_mesh_arrays(gltf: dict, bin_chunk: bytes) -> tuple[np.ndarray, np.ndarray]:
    primitive = gltf["meshes"][0]["primitives"][0]
    position_accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
    position_view = gltf["bufferViews"][position_accessor["bufferView"]]
    index_accessor = gltf["accessors"][primitive["indices"]]
    index_view = gltf["bufferViews"][index_accessor["bufferView"]]

    positions = np.frombuffer(
        bin_chunk,
        dtype=np.float32,
        count=position_accessor["count"] * 3,
        offset=position_view.get("byteOffset", 0),
    ).reshape(-1, 3)

    indices = np.frombuffer(
        bin_chunk,
        dtype=np.uint32,
        count=index_accessor["count"],
        offset=index_view.get("byteOffset", 0),
    ).reshape(-1, 3)

    return positions, indices


def simplify_mesh(positions: np.ndarray, indices: np.ndarray, divisions: int) -> tuple[np.ndarray, np.ndarray]:
    mins = positions.min(axis=0)
    spans = positions.max(axis=0) - mins
    max_extent = float(spans.max()) or 1.0
    voxel = max_extent / divisions

    quantized = np.floor((positions - mins) / voxel).astype(np.int32)
    quantized -= quantized.min(axis=0)
    dims = quantized.max(axis=0).astype(np.uint64) + 1

    keys = (
        quantized[:, 0].astype(np.uint64)
        + quantized[:, 1].astype(np.uint64) * dims[0]
        + quantized[:, 2].astype(np.uint64) * dims[0] * dims[1]
    )

    _, inverse = np.unique(keys, return_inverse=True)
    counts = np.bincount(inverse)

    reduced_positions = np.column_stack(
        [
            np.bincount(inverse, weights=positions[:, axis]) / counts
            for axis in range(3)
        ]
    ).astype(np.float32)

    reduced_faces = inverse[indices]
    valid_faces = (
        (reduced_faces[:, 0] != reduced_faces[:, 1])
        & (reduced_faces[:, 1] != reduced_faces[:, 2])
        & (reduced_faces[:, 0] != reduced_faces[:, 2])
    )
    reduced_faces = reduced_faces[valid_faces]

    sorted_faces = np.sort(reduced_faces, axis=1)
    packed_faces = np.ascontiguousarray(sorted_faces).view(
        np.dtype((np.void, sorted_faces.dtype.itemsize * 3))
    )
    _, unique_indices = np.unique(packed_faces, return_index=True)
    reduced_faces = reduced_faces[np.sort(unique_indices)].astype(np.uint32)

    return reduced_positions, reduced_faces


def pad4_binary(data: bytes) -> bytes:
    padding = (-len(data)) % 4
    return data + (b"\x00" * padding)


def pad4_json(data: bytes) -> bytes:
    padding = (-len(data)) % 4
    return data + (b"\x20" * padding)


def write_glb(path: Path, positions: np.ndarray, indices: np.ndarray) -> None:
    position_bytes = positions.astype(np.float32).tobytes()
    index_bytes = indices.astype(np.uint32).ravel().tobytes()
    position_length = len(position_bytes)
    index_offset = position_length
    bin_chunk = pad4_binary(position_bytes + index_bytes)

    gltf = {
        "asset": {"version": "2.0", "generator": "optimize_foot_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "mode": 4,
                    }
                ]
            }
        ],
        "buffers": [{"byteLength": len(bin_chunk)}],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": position_length,
                "target": 34962,
            },
            {
                "buffer": 0,
                "byteOffset": index_offset,
                "byteLength": len(index_bytes),
                "target": 34963,
            },
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": int(len(positions)),
                "type": "VEC3",
                "min": positions.min(axis=0).tolist(),
                "max": positions.max(axis=0).tolist(),
            },
            {
                "bufferView": 1,
                "componentType": 5125,
                "count": int(indices.size),
                "type": "SCALAR",
            },
        ],
    }

    json_chunk = pad4_json(json.dumps(gltf, separators=(",", ":")).encode("utf-8"))
    total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)

    with path.open("wb") as handle:
        handle.write(struct.pack("<III", 0x46546C67, 2, total_length))
        handle.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
        handle.write(json_chunk)
        handle.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        handle.write(bin_chunk)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a lightweight foot GLB for particle morph sampling.")
    parser.add_argument("--input", default="model/foot.glb")
    parser.add_argument("--output", default="model/foot-optimized.glb")
    parser.add_argument("--divisions", type=int, default=96)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    gltf, bin_chunk = load_glb(input_path)
    positions, indices = extract_mesh_arrays(gltf, bin_chunk)
    reduced_positions, reduced_faces = simplify_mesh(positions, indices, args.divisions)
    write_glb(output_path, reduced_positions, reduced_faces)

    print(f"input: {input_path} -> {input_path.stat().st_size / (1024 * 1024):.2f} MB")
    print(f"output: {output_path} -> {output_path.stat().st_size / (1024 * 1024):.2f} MB")
    print(f"vertices: {len(positions)} -> {len(reduced_positions)}")
    print(f"triangles: {len(indices)} -> {len(reduced_faces)}")


if __name__ == "__main__":
    main()
