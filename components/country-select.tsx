'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Globe } from 'lucide-react';
import { ALL_COUNTRIES, MAJOR_COUNTRIES, searchCountries, type Country } from '@/lib/countries';

interface CountrySelectProps {
  value?: string;
  onChange: (countryName: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CountrySelect({
  value = '',
  onChange,
  placeholder = '국가를 검색하거나 선택하세요 (예: 베트남, 미국, 네팔)',
  className = '',
  disabled = false,
}: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 현재 선택된 국가 객체 찾기
  const selectedCountry = useMemo(() => {
    if (!value) return null;
    return (
      ALL_COUNTRIES.find(
        (c) => c.name === value || c.en.toLowerCase() === value.toLowerCase()
      ) || { name: value, en: value, code: '', flag: '🌐' }
    );
  }, [value]);

  // 검색 쿼리에 따른 필터링 결과
  const filteredCountries = useMemo(() => {
    return searchCountries(query);
  }, [query]);

  // 바깥 영역 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // 드롭다운 닫힐 때 검색어 초기화
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (countryName: string) => {
    onChange(countryName);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-50' : 'z-auto'} ${className}`}>
      {/* Input 필드 영역 */}
      <div
        className={`relative flex items-center w-full rounded-2xl border bg-card transition-all ${
          isOpen
            ? 'border-primary ring-2 ring-primary/20 shadow-md'
            : 'border-input shadow-xs hover:border-muted-foreground/40'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="pl-3.5 pr-2 text-muted-foreground flex items-center justify-center">
          {selectedCountry && !isOpen ? (
            <span className="text-base select-none">{selectedCountry.flag}</span>
          ) : (
            <Search className="size-4" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? query : value || ''}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
          }}
          placeholder={selectedCountry && !isOpen ? selectedCountry.name : placeholder}
          className="w-full bg-transparent py-3.5 pr-10 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        <div className="absolute right-3 flex items-center gap-1">
          {value && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="지우기"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setQuery('');
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-primary' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* 드롭박스 팝업 (검색 결과 및 국가 목록) */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1.5 max-h-72 w-full overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col">
          {/* 주요 국가 퀵 선택 바 (검색어가 없을 때만 노출) */}
          {!query.trim() && (
            <div className="p-2.5 bg-muted/40 border-b border-border/60">
              <div className="text-[11px] font-black text-muted-foreground mb-1.5 flex items-center gap-1">
                <span>⚡ 자주 찾는 주요 국적</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {MAJOR_COUNTRIES.map((c) => {
                  const isSelected = value === c.name;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelect(c.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-card border border-border/70 hover:border-primary/50 hover:bg-primary/5 text-foreground'
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 국가 스크롤 리스트 */}
          <div className="overflow-y-auto flex-1 p-1.5 space-y-0.5 divide-y divide-border/30">
            {filteredCountries.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Globe className="size-6 mx-auto mb-2 opacity-40" />
                <p className="font-bold">검색된 국가가 없습니다.</p>
                <p className="text-[11px] mt-0.5">&apos;{query}&apos; 철자를 다시 확인해 주세요.</p>
              </div>
            ) : (
              <>
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {query.trim() ? `검색 결과 (${filteredCountries.length}개국)` : `전 세계 모든 국가 (${ALL_COUNTRIES.length}개국)`}
                </div>
                {filteredCountries.map((c) => {
                  const isSelected = value === c.name;
                  return (
                    <button
                      key={c.code + c.name}
                      type="button"
                      onClick={() => handleSelect(c.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-black'
                          : 'hover:bg-muted/70 text-foreground font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base select-none shrink-0">{c.flag}</span>
                        <div className="truncate">
                          <span className="font-bold">{c.name}</span>
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            {c.en}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check className="size-4 text-primary shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
