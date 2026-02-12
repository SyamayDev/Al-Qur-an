
var app = new Vue({
    el: '#app',
    data: {
        allSurahs: [],
        detail: {},
        ayats: [],
        loading: false,
        loading2: false,
        audioUrl: '',
        surahAudio: null,
        surahAudioPlaying: false,
        surahAudioCurrent: 0,
        surahAudioDuration: 0,
        currentAudio: null,
        currentAudioIndex: null,
        isPlaying: false,
        copiedAyats: {},
        lastRead: null,
        bookmarkedSurahs: {},
        showFavorites: false,
        searchQuery: '',
        currentPage: 1,
        itemsPerPage: 12, // 12 surah per halaman di desktop
        showVoicePopup: false,
        voiceText: '',
        isDarkMode: false,
        
    },
    computed: {
        filteredSurahs() {
            let filtered = this.allSurahs;
            if (this.showFavorites) filtered = filtered.filter(s => this.isSurahBookmarked(s.nomor));
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase().replace(/[\s-]/g, '');
                filtered = filtered.filter(s => {
                    const namaLatinNormalized = s.nama_latin.toLowerCase().replace(/[\s-]/g, '');
                    const namaNormalized = s.nama.toLowerCase().replace(/[\s-]/g, '');
                    const artiNormalized = s.arti.toLowerCase().replace(/[\s-]/g, '');
                    return (
                        namaLatinNormalized.includes(query) ||
                        namaNormalized.includes(query) ||
                        artiNormalized.includes(query)
                    );
                });
            }
            return filtered;
        },
        totalPages() { return Math.ceil(this.filteredSurahs.length / this.itemsPerPage); },
        paginatedSurahs() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.filteredSurahs.slice(start, end);
        },
        currentIndex() { return this.filteredSurahs.findIndex(s => s.nomor == this.detail.nomor); },
        hasPrev() { return this.currentIndex > 0; },
        hasNext() { return this.currentIndex >= 0 && this.currentIndex < this.filteredSurahs.length - 1; }
    },
    methods: {
        refreshPage() { window.location.reload(); },
        padNumber(num, digits) { return num.toString().padStart(digits, '0'); },
        getDetail(nomorSurah) {
            this.loading2 = true;
            // Fetch data dari equran.id
            this.$http.get(`https://equran.id/api/surat/${nomorSurah}`).then(response => {
              let res = response.body;
              this.detail = {
                nomor: res.nomor,
                nama: res.nama,
                asma: res.nama_latin,
                arti: res.arti,
                type: res.tempat_turun,
                keterangan: res.deskripsi || ""
              };
              let rawAyats = res.ayat || [];
          
              // Fetch data audio dari api.alquran.cloud
              this.$http.get(`https://api.alquran.cloud/v1/surah/${nomorSurah}/ar.alafasy`).then(audioResponse => {
                let audioData = audioResponse.body.data;
                this.ayats = rawAyats.map((a, index) => {
                  let audioUrl = audioData.ayahs[index].audio; // URL audio per ayat dari api.alquran.cloud
                  return {
                    nomor: a.nomor,
                    ar: a.ar,
                    tr: a.tr,
                    id: a.idn,
                    audio: audioUrl // Tambahkan URL audio ke setiap ayat
                  };
                });
          
                // Tetap pertahankan audio surah keseluruhan
                this.audioUrl = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${nomorSurah}.mp3`;
                this.initSurahAudio();
                this.loading2 = false;
                this.$nextTick(() => this.initSelect2());
              }).catch(err => {
                console.error('Error mengambil data audio:', err);
                // Jika gagal mengambil audio, tetap tampilkan ayat tanpa audio
                this.ayats = rawAyats.map(a => ({
                  nomor: a.nomor,
                  ar: a.ar,
                  tr: a.tr,
                  id: a.idn,
                  audio: null // Audio tidak tersedia jika gagal
                }));
                this.audioUrl = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${nomorSurah}.mp3`;
                this.initSurahAudio();
                this.loading2 = false;
                this.$nextTick(() => this.initSelect2());
              });
            }).catch(err => {
              console.error('Error mengambil detail surah:', err);
              this.loading2 = false;
            });
          },
        openDetailModal(nomorSurah) {
            this.getDetail(nomorSurah);
            $('#detailModal').modal('show');
        },
        initSurahAudio() {
            if (this.surahAudio) this.surahAudio.pause();
            this.surahAudio = new Audio(this.audioUrl);
            this.surahAudio.addEventListener('loadedmetadata', () => { this.surahAudioDuration = this.surahAudio.duration; });
            this.surahAudio.addEventListener('timeupdate', () => { this.surahAudioCurrent = this.surahAudio.currentTime; });
            this.surahAudio.addEventListener('ended', () => { this.surahAudioPlaying = false; });
        },
        toggleSurahAudio() {
            if (!this.surahAudio) return;
            if (this.surahAudioPlaying) {
                this.surahAudio.pause();
                this.surahAudioPlaying = false;
            } else {
                this.surahAudio.play();
                this.surahAudioPlaying = true;
            }
        },
        rewindSurahAudio() { if (this.surahAudio) this.surahAudio.currentTime = Math.max(0, this.surahAudio.currentTime - 5); },
        forwardSurahAudio() { if (this.surahAudio) this.surahAudio.currentTime = Math.min(this.surahAudioDuration, this.surahAudio.currentTime + 5); },
        seekSurahAudio(e) { if (this.surahAudio) this.surahAudio.currentTime = e.target.value; },
        formatTime(sec) {
            let m = Math.floor(sec / 60);
            let s = Math.floor(sec % 60);
            return `${m}:${s < 10 ? '0' : ''}${s}`;
        },
                togglePlay(item, idx) {
            if (this.currentAudio && this.currentAudioIndex === idx) {
                if (this.isPlaying) {
                    this.currentAudio.pause();
                    this.isPlaying = false;
                } else {
                    this.currentAudio.play();
                    this.isPlaying = true;
                }
            } else {
                if (this.currentAudio) this.currentAudio.pause();
                this.currentAudio = new Audio(item.audio);
                this.currentAudioIndex = idx;
                this.isPlaying = true;
                this.currentAudio.onended = () => {
                    let nextIdx = idx + 1;
                    if (nextIdx < this.ayats.length) this.togglePlay(this.ayats[nextIdx], nextIdx);
                    else { this.isPlaying = false; this.currentAudio = null; this.currentAudioIndex = null; }
                };
                this.currentAudio.play().catch(err => {
                    console.error('Error playing audio:', err);
                    this.isPlaying = false;
                });
                let t = document.getElementById(`ayat-${idx+1}`);
                if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        },
        copyAyat(idx, item) {
            let text = `Ayat ${idx}\nArab: ${item.ar}\nLatin: ${item.tr}\nTerjemahan: ${item.id}`;
            navigator.clipboard.writeText(text).then(() => {
                this.$set(this.copiedAyats, item.nomor, true);
                setTimeout(() => this.$delete(this.copiedAyats, item.nomor), 1000);
            });
        },
        shareAyat(ayat) {
            const shareText = `QS. ${this.detail.asma} Ayat ${ayat.nomor}\n\n${ayat.ar}\n\n${ayat.tr || ''}\n\n${ayat.id || ''}\n\nVia MyQur'an`;
            
            if (navigator.share) {
                navigator.share({
                    title: `QS. ${this.detail.asma} Ayat ${ayat.nomor}`,
                    text: shareText,
                    url: window.location.href
                }).catch(err => console.error('Error sharing:', err));
            } else {
                navigator.clipboard.writeText(shareText).then(() => {
                    alert('Teks ayat berhasil disalin ke clipboard!');
                });
            }
        },
        
        initSelect2() {
            $('#ayatSelect').select2({
                placeholder: 'Pilih ayat...',
                allowClear: true,
                data: this.ayats.map(a => ({ id: a.nomor, text: `Ayat ${a.nomor}: ${a.ar.substring(0, 20)}...` }))
            });
            $('#ayatSelect').on('change', () => {
                let val = $('#ayatSelect').val();
                if (val) document.getElementById(`ayat-${val}`).scrollIntoView({ behavior: "smooth", block: "start" });
            });
        },
        isAyatBookmarked(surahNumber, ayatNumber) {
            return this.lastRead && this.lastRead.surahNumber === surahNumber && this.lastRead.ayatNumber === ayatNumber;
        },
        toggleAyatBookmark(ayat) {
            this.lastRead = this.isAyatBookmarked(this.detail.nomor, ayat.nomor) ? null : {
                surahNumber: this.detail.nomor,
                surahName: this.detail.asma,
                ayatNumber: ayat.nomor,
                ar: ayat.ar,
                tr: ayat.tr,
                id: ayat.id
            };
            this.saveBookmarks();
        },
        goToLastRead() {
            if (this.lastRead) {
                this.getDetail(this.lastRead.surahNumber);
                $('#detailModal').modal('show');
                this.$nextTick(() => {
                    setTimeout(() => document.getElementById(`ayat-${this.lastRead.ayatNumber}`).scrollIntoView({ behavior: "smooth", block: "start" }), 500);
                });
            }
        },
        clearLastRead() {
            this.lastRead = null;
            this.saveBookmarks();
        },
        isSurahBookmarked(surahNumber) { return !!this.bookmarkedSurahs[surahNumber]; },
        toggleSurahBookmark(surah) {
            if (this.isSurahBookmarked(surah.nomor)) {
                this.$delete(this.bookmarkedSurahs, surah.nomor);
            } else {
                this.$set(this.bookmarkedSurahs, surah.nomor, surah);
            }
            this.saveBookmarks();
        },
        filterSurahs() { this.currentPage = 1; },
        previousPage() { if (this.currentPage > 1) this.currentPage--; },
        nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; },
        prevSurah() { if (this.hasPrev) this.getDetail(this.filteredSurahs[this.currentIndex - 1].nomor); },
        nextSurah() { if (this.hasNext) this.getDetail(this.filteredSurahs[this.currentIndex + 1].nomor); },
        toggleShowFavorites() { this.showFavorites = !this.showFavorites; this.currentPage = 1; },
        startVoiceSearch() {
            if (!('webkitSpeechRecognition' in window)) {
                alert('Browser Anda tidak mendukung fitur pencarian suara.');
                return;
            }
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'id-ID';
            recognition.continuous = false;
            recognition.interimResults = true;

            this.showVoicePopup = true;
            this.voiceText = 'Mendengarkan...';
            document.body.classList.remove('modal-open');
            if (document.querySelector('.modal-backdrop')) {
                document.querySelector('.modal-backdrop').remove();
            }

            recognition.onresult = (event) => {
                const interimTranscript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                this.voiceText = interimTranscript || 'Mendengarkan...';
                if (event.results[0].isFinal) {
                    this.searchQuery = event.results[0][0].transcript;
                    this.filterSurahs();
                    setTimeout(() => {
                        this.showVoicePopup = false;
                        document.body.classList.remove('modal-open');
                        if (document.querySelector('.modal-backdrop')) {
                            document.querySelector('.modal-backdrop').remove();
                        }
                    }, 1000);
                }
            };
            recognition.onend = () => {
                if (this.voiceText === 'Mendengarkan...') {
                    this.voiceText = 'Tidak ada suara terdeteksi';
                    setTimeout(() => {
                        this.showVoicePopup = false;
                        document.body.classList.remove('modal-open');
                        if (document.querySelector('.modal-backdrop')) {
                            document.querySelector('.modal-backdrop').remove();
                        }
                    }, 1000);
                }
            };
            recognition.onerror = (event) => {
                this.voiceText = 'Error: ' + event.error;
                setTimeout(() => {
                    this.showVoicePopup = false;
                    document.body.classList.remove('modal-open');
                    if (document.querySelector('.modal-backdrop')) {
                        document.querySelector('.modal-backdrop').remove();
                    }
                }, 1000);
                console.error('Voice recognition error:', event.error);
            };
            recognition.start();
        },
        loadBookmarks() {
            const savedBookmarks = localStorage.getItem('bookmarkedSurahs');
            const savedLastRead = localStorage.getItem('lastRead');
            if (savedBookmarks) {
                this.bookmarkedSurahs = JSON.parse(savedBookmarks);
            }
            if (savedLastRead) {
                this.lastRead = JSON.parse(savedLastRead);
            }
        },
        saveBookmarks() {
            localStorage.setItem('bookmarkedSurahs', JSON.stringify(this.bookmarkedSurahs));
            localStorage.setItem('lastRead', JSON.stringify(this.lastRead));
        }
    },
    watch: {
        isDarkMode(val) {
            if (val) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        }
    },
    mounted() {
        this.loadBookmarks();
        this.loading = true;
        this.$http.get('https://equran.id/api/surat').then(res => {
            this.allSurahs = res.body;
            let cumulative = 0;
            this.allSurahs.forEach(s => {
                s.startAyat = cumulative + 1;
                cumulative += s.jumlah_ayat;
            });
            this.loading = false;
        }).catch(err => {
            console.error('error', err);
            this.loading = false;
        });

                $('#detailModal').on('hidden.bs.modal', () => {
            if (this.surahAudio) this.surahAudio.pause();
            if (this.currentAudio) this.currentAudio.pause();
            this.surahAudioPlaying = false;
            this.isPlaying = false;
            this.currentAudio = null;
            this.currentAudioIndex = null;
        });

        // Theme initialization
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.isDarkMode = savedTheme === 'dark';
        } else {
            this.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        if (this.isDarkMode) document.body.classList.add('dark-mode');
    }
});
