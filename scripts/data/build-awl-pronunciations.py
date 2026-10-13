"""Build US IPA and approximate Persian syllable guides from CMUdict.
Usage: python3 scripts/data/build-awl-pronunciations.py /path/to/cmudict.dict
CMUdict is distributed under the license in public/licenses/cmudict.txt.
"""
import json, re, sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
dictionary = {}
for line in Path(sys.argv[1]).read_text().splitlines():
    parts = line.split('#', 1)[0].split()
    if not parts: continue
    dictionary.setdefault(re.sub(r'\(\d+\)$', '', parts[0]), []).append(parts[1:])
aliases = {'analyse':'analyze','labour':'labor','maximise':'maximize','licence':'license','utilise':'utilize','minimise':'minimize'}
ipa = dict(zip('AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH'.split(), 'ɑ æ ʌ ɔ aʊ aɪ b tʃ d ð ɛ ɝ eɪ f ɡ h ɪ i dʒ k l m n ŋ oʊ ɔɪ p ɹ s ʃ t θ ʊ u v w j z ʒ'.split()))
fa = dict(zip('AA AE AH AO AW AY B CH D DH EH ER EY F G HH IH IY JH K L M N NG OW OY P R S SH T TH UH UW V W Y Z ZH'.split(), ['آ','اَ','آ','آ','آو','آی','ب','چ','د','ذ','اِ','اِر','اِی','ف','گ','ه','اِ','ای','ج','ک','ل','م','ن','نگ','اُو','اُی','پ','ر','س','ش','ت','ث','اُ','او','و','و','ی','ز','ژ']))
# Maximal English onsets locate stress at syllable beginnings. No syllable dots
# are added to IPA because vowel/consonant boundaries can vary by analysis.
onsets = set('P R|P L|B R|B L|T R|D R|K R|K L|G R|G L|F R|F L|TH R|SH R|S P|S T|S K|S M|S N|S L|S W|S P R|S P L|S T R|S K R|S K W|K W|T W|D W|P Y|B Y|T Y|D Y|K Y|G Y|F Y|V Y|M Y|N Y|HH Y'.split('|'))
def syllables(phones):
    vowels = [i for i,p in enumerate(phones) if p[-1].isdigit()]
    starts = [0]
    for previous,current in zip(vowels,vowels[1:]):
        start = current
        for candidate in range(previous+1,current):
            cluster = phones[candidate:current]
            if (len(cluster)==1 and cluster[0]!='NG') or ' '.join(cluster) in onsets:
                start = candidate; break
        starts.append(start)
    return [phones[start:end] for start,end in zip(starts,starts[1:]+[len(phones)])]
def convert(phones):
    english=[];persian=[]
    for syllable in syllables(phones):
        stress = next((p[-1] for p in syllable if p[-1].isdigit()),'0')
        english.append({'1':'ˈ','2':'ˌ','0':''}[stress]+''.join('ə' if p=='AH0' else 'ɚ' if p=='ER0' else ipa[re.sub('[012]','',p)] for p in syllable))
        result=''
        for i,p in enumerate(syllable):
            symbol=re.sub('[012]','',p);value='اَ' if p=='AH0' else fa[symbol]
            if i:
                value = {'AA':'ا','AO':'ا','AW':'او','AY':'ای','IY':'ی','UW':'و','OW':'ُو','EY':'ِی','OY':'ُی'}.get(symbol, value.removeprefix('ا') if symbol in {'AE','AH','EH','IH','UH','ER'} else value)
            result+=value
        persian.append('«'+result+'»' if stress=='1' else result)
    return '/'+''.join(english)+'/', ' ـ '.join(persian)
path=root/'src/data/academic-word-list.json';rows=json.loads(path.read_text())
for row in rows:
    variants=dictionary[aliases.get(row['word'],row['word'])]
    converted=list(dict.fromkeys(convert(p) for p in variants))
    row['pronunciationIpa']=' · '.join(v[0] for v in converted)
    row['pronunciationFa']=' / '.join(v[1] for v in converted)
path.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(f'Added pronunciations to {len(rows)} families.')
for row in rows[:10]: print(row['word'],row['pronunciationIpa'],row['pronunciationFa'])
