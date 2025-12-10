# 📈 Analisis Statistik - Academic RAG Chatbot

> Dokumentasi metode analisis statistik untuk evaluasi performa sistem.

---

## 1. Statistik Deskriptif

### Metrik yang Dihitung
| Statistik | Formula | Kegunaan |
|-----------|---------|----------|
| Mean | $\bar{X} = \frac{\sum X_i}{n}$ | Nilai rata-rata |
| Median | Middle value | Measure central tendency |
| Std Dev | $s = \sqrt{\frac{\sum(X_i - \bar{X})^2}{n-1}}$ | Variabilitas |
| SEM | $\frac{s}{\sqrt{n}}$ | Standard error |
| Skewness | - | Distribusi |
| Kurtosis | - | Puncak distribusi |

---

## 2. Paired t-Test

### Tujuan
Membandingkan RAG vs Non-RAG pada sample yang sama (paired).

### Formula
$$t = \frac{\bar{d}}{s_d / \sqrt{n}}$$

**Keterangan:**
- $\bar{d}$ = Mean perbedaan (RAG - Non-RAG)
- $s_d$ = Standar deviasi perbedaan
- $n$ = Jumlah observasi berpasangan
- $df = n - 1$

### Hipotesis
- **H₀**: Tidak ada perbedaan signifikan
- **H₁**: RAG menghasilkan skor lebih tinggi
- **α** = 0.05

---

## 3. Independent t-Test

### Tujuan
Membandingkan dua grup independen (misalnya konfigurasi berbeda).

### Welch's t-Test
Digunakan ketika varians tidak sama antar grup.

---

## 4. One-Way ANOVA

### Tujuan
Membandingkan lebih dari 2 grup konfigurasi secara simultan.

### Formula
$$F = \frac{\text{MS}_{between}}{\text{MS}_{within}}$$

$$F = \frac{\sum n_j(\bar{X}_j - \bar{X})^2 / (k-1)}{\sum\sum(X_{ij} - \bar{X}_j)^2 / (N-k)}$$

**Keterangan:**
- $k$ = Jumlah grup
- $N$ = Total observasi
- $\bar{X}_j$ = Mean grup $j$
- $\bar{X}$ = Grand mean

### Post-Hoc: Tukey HSD
Jika ANOVA signifikan, lakukan Tukey HSD untuk pairwise comparison.

---

## 5. Effect Size

### Cohen's d
$$d = \frac{\bar{X}_1 - \bar{X}_2}{s_{pooled}}$$

$$s_{pooled} = \sqrt{\frac{(n_1-1)s_1^2 + (n_2-1)s_2^2}{n_1 + n_2 - 2}}$$

**Interpretasi:**
| Cohen's d | Interpretasi |
|-----------|--------------|
| 0.2 | Efek kecil |
| 0.5 | Efek sedang |
| 0.8 | Efek besar |

### Eta-Squared (η²)
$$\eta^2 = \frac{\text{SS}_{between}}{\text{SS}_{total}}$$

**Interpretasi:**
| η² | Interpretasi |
|----|--------------|
| 0.01 | Efek kecil |
| 0.06 | Efek sedang |
| 0.14 | Efek besar |

---

## 6. Confidence Interval

### Parametric 95% CI
$$\text{CI}_{95\%} = \bar{X} \pm t_{0.025, df} \cdot \frac{s}{\sqrt{n}}$$

### Bootstrap CI
- Iterations: 1000-2000
- Method: Percentile
- Robust terhadap distribusi non-normal

---

## 7. Reporting Format

### t-Test
```
t(df) = value, p < threshold, d = effect_size
Contoh: t(49) = 8.234, p < 0.001, d = 1.89
```

### ANOVA
```
F(df_between, df_within) = value, p < threshold, η² = effect_size
Contoh: F(4, 245) = 12.567, p < 0.001, η² = 0.17
```

### Confidence Interval
```
M = value, 95% CI [lower, upper]
Contoh: M = 0.847, 95% CI [0.812, 0.882]
```

---

## 8. Contoh Hasil

### Perbandingan RAG vs Non-RAG
| Metrik | Non-RAG | RAG | p-value | Cohen's d |
|--------|---------|-----|---------|-----------|
| Faithfulness | 0.62 | 0.85 | <0.001 | 1.89 |
| Relevancy | 0.65 | 0.82 | <0.001 | 1.45 |
| Hallucination | 0.35 | 0.12 | <0.001 | -1.67 |

### Interpretasi
> "Hasil evaluasi menunjukkan bahwa sistem RAG (M = 0.847, SD = 0.089) secara signifikan lebih baik dibandingkan baseline Non-RAG (M = 0.623, SD = 0.142) dalam metrik Faithfulness, t(49) = 8.234, p < 0.001, d = 1.89 (efek besar)."

---

*Analisis statistik sistem Academic RAG Chatbot.*
