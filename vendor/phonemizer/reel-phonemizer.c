/* MIT binding; linking eSpeak NG produces a GPL-3.0-or-later engine. */
#include <espeak-ng/speak_lib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static int initialized = 0;
static int last_error = 0;
int reel_error(void) { return last_error; }
char *reel_phonemize(const char *text, const char *voice) {
  last_error = 0;
  if (!initialized) {
    if (espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 100, NULL,
        espeakINITIALIZE_DONT_EXIT) <= 0) { last_error=1; return NULL; }
    initialized=1;
  }
  if (espeak_SetVoiceByName(voice) != EE_OK) { last_error=2; return NULL; }
  FILE *output=tmpfile();
  if (!output) { last_error=3; return NULL; }
  espeak_SetSynthCallback(NULL);
  espeak_SetPhonemeTrace(espeakPHONEMES_IPA, output);
  espeak_ERROR result=espeak_Synth(text, strlen(text)+1, 0, POS_CHARACTER,
      0, espeakCHARS_UTF8, NULL, NULL);
  espeak_SetPhonemeTrace(0, NULL);
  if (result != EE_OK || fseek(output,0,SEEK_END) != 0) {
    fclose(output); last_error=4; return NULL;
  }
  long size=ftell(output);
  if(size<0) { fclose(output); last_error=5; return NULL; }
  rewind(output);
  char *value=malloc((size_t)size+1);
  if(!value) { fclose(output); last_error=6; return NULL; }
  size_t count=fread(value,1,(size_t)size,output);
  fclose(output);
  if(count != (size_t)size) { free(value); last_error=7; return NULL; }
  value[count]=0;
  return value;
}
static void json_string(FILE *output, const char *text) {
  fputc('"',output);
  for(const unsigned char *p=(const unsigned char *)text;*p;p++) {
    if(*p=='"'||*p=='\\') { fputc('\\',output);fputc(*p,output); }
    else if(*p<32) fprintf(output,"\\u%04x",*p);
    else fputc(*p,output);
  }
  fputc('"',output);
}
char *reel_voices(void) {
  if(!initialized) {
    if(espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS,100,NULL,espeakINITIALIZE_DONT_EXIT)<=0) return NULL;
    initialized=1;
  }
  FILE *output=tmpfile();if(!output)return NULL;
  const espeak_VOICE **voices=espeak_ListVoices(NULL);
  fputc('[',output);
  for(int i=0;voices&&voices[i];i++) {
    if(i)fputc(',',output);
    fputs("{\"name\":",output);json_string(output,voices[i]->name);
    fputs(",\"identifier\":",output);json_string(output,voices[i]->identifier);
    fputs(",\"languages\":[",output);
    const unsigned char *language=(const unsigned char *)voices[i]->languages;
    int count=0;
    while(language&&*language) {
      unsigned int priority=*language++;
      if(count++)fputc(',',output);
      fprintf(output,"{\"priority\":%u,\"name\":",priority);
      json_string(output,(const char *)language);fputc('}',output);
      language+=strlen((const char *)language)+1;
    }
    fputs("]}",output);
  }
  fputc(']',output);fflush(output);
  if(fseek(output,0,SEEK_END)!=0){fclose(output);return NULL;}
  long size=ftell(output);if(size<0){fclose(output);return NULL;}
  rewind(output);char *value=malloc((size_t)size+1);
  if(!value){fclose(output);return NULL;}
  size_t count=fread(value,1,(size_t)size,output);fclose(output);
  if(count!=(size_t)size){free(value);return NULL;}
  value[count]=0;return value;
}
