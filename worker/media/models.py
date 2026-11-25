"""The speech models in the speech image (Task 4): pinned, fetched when the image is built and checked.

Never fetched when a container starts: `app.py` runs FETCH as the image's build steps, after the
packages of `media-requirements.txt`, and the containers read the files from MODELS.
- Whisper: faster-whisper's `large-v3-turbo`, the CTranslate2 model its names map to (the repo was
  moved from mobiuslabsgmbh to dropbox-dash; this is the same model), at a fixed revision.
- The aligner: WhisperX's default model for each language baked in (torchaudio's wav2vec2 pipelines,
  as torchaudio 2.8.0 names them).
- Punkt's tables, which WhisperX loads to split sentences (and else fetches when first used).

The face model (Task 5) is fetched apart, after MediaPipe is installed (`FETCH_FACES`), and checked; its
library is loaded once as the image is built, so a library that cannot load fails the build, not a take.
"""

MODELS = "/models"

WHISPER_REPO = "dropbox-dash/faster-whisper-large-v3-turbo"
WHISPER_REVISION = "0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf"
WHISPER_SHA256 = "e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da"  # model.bin
WHISPER_DIR = f"{MODELS}/whisper"

ALIGN_DIR = f"{MODELS}/align"
# The languages whose aligner is in the image, and its file's sha256 (WhisperX's defaults: wav2vec2
# base fine-tuned on LibriSpeech for English, on VoxPopuli for German and Italian).
ALIGNERS = {
    "en": ("wav2vec2_fairseq_base_ls960_asr_ls960.pth", "488fd4f16de84438ffc945334278c1b9fb9b7159a806c1080b16111a958c945d"),
    "de": ("wav2vec2_voxpopuli_base_10k_asr_de.pt", "5fcd937817d4cc358aa9730ccaa92cdae37af4b62959b67ba77ef1f5da7938cf"),
    "it": ("wav2vec2_voxpopuli_base_10k_asr_it.pt", "620bad579ee46ba1f67df2e7c858c111d14a09b349a62b1c672f0275a68484eb"),
}

NLTK_DIR = f"{MODELS}/nltk"
PUNKT_URL = "https://raw.githubusercontent.com/nltk/nltk_data/4f15a3d89eefe9748ec1c05be495d91289197155/packages/tokenizers/punkt_tab.zip"
PUNKT_SHA256 = "e57f64187974277726a3417ca6f181ec5403676c717672eef6a748a7b20e0106"

# MediaPipe's Face Landmarker (X48), float16, version 1 of its models' bucket (the same file as "latest" on
# 2026-11-20): a face detector, the 478-landmark mesh and the blendshapes, in one .task file.
FACES_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
FACES_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
FACES_MODEL = f"{MODELS}/faces/face_landmarker.task"

# Where the libraries look, set in the image: Hugging Face, torch's hub and NLTK.
ENV = {"HF_HOME": f"{MODELS}/hf", "TORCH_HOME": f"{MODELS}/torch", "NLTK_DATA": NLTK_DIR}

_whisper = (f"from huggingface_hub import snapshot_download; "
            f"snapshot_download('{WHISPER_REPO}', revision='{WHISPER_REVISION}', local_dir='{WHISPER_DIR}')")
_aligners = f"import whisperx; [whisperx.load_align_model(l, 'cpu', model_dir='{ALIGN_DIR}') for l in {tuple(ALIGNERS)!r}]"
_punkt = f"import urllib.request; urllib.request.urlretrieve('{PUNKT_URL}', '/tmp/punkt_tab.zip')"
_check = " && ".join(f"echo '{sha}  {path}' | sha256sum -c -" for sha, path in [
    (WHISPER_SHA256, f"{WHISPER_DIR}/model.bin"), (PUNKT_SHA256, "/tmp/punkt_tab.zip"),
    *((sha, f"{ALIGN_DIR}/{name}") for name, sha in ALIGNERS.values())])

FETCH = (
    f'python -c "{_whisper}"',
    f'python -c "{_aligners}"',
    f'python -c "{_punkt}"',
    _check,
    f"mkdir -p {NLTK_DIR}/tokenizers && python -m zipfile -e /tmp/punkt_tab.zip {NLTK_DIR}/tokenizers && rm /tmp/punkt_tab.zip",
)

_faces_load = "from mediapipe.tasks.python.core import mediapipe_c_bindings; mediapipe_c_bindings.load_raw_library()"

FETCH_FACES = (
    f"mkdir -p {MODELS}/faces && python -c \"import urllib.request; urllib.request.urlretrieve('{FACES_URL}', '{FACES_MODEL}')\"",
    f"echo '{FACES_SHA256}  {FACES_MODEL}' | sha256sum -c -",
    # Imports MediaPipe's tasks (its vision tasks import cv2 and matplotlib, whose font cache is built here,
    # once) and loads its library, which needs libEGL and libGLESv2. The landmarker is first made by the tests.
    f'python -c "{_faces_load}"',
)
