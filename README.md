<!-- ax-kit-readme -->
# AX AI 엔지니어링 킷

새 프로젝트를 **AI 세팅이 끝난 상태**로 시작하기 위한 기반 저장소입니다.
프롬프트 · 컨텍스트 · 하네스 · 루프 · 그래프 5계층을 Claude Code에 세팅하고, 서비스 종류·스택 같은 스펙은 프로젝트마다 인터뷰로 정합니다.

## 시작하기
```bash
git clone https://github.com/Mrzero-00/ax-studio.git my-service
cd my-service
claude
```
첫 세션에서 Claude가 새 프로젝트로 시작할지 묻고, `/ax-setup`으로 진행합니다.
1. **init** — 원격 `origin`을 `ax`로 바꿔 킷 원본과 연결해 두고, README를 프로젝트용으로 교체합니다.
2. **"어떤 서비스를 만드실건가요?"** — 서비스 유형에 맞는 추천을 보며 L0~L5를 한 단계씩 확정합니다.
3. 새 저장소 연결: `git remote add origin <새 저장소 주소>`

세팅 후에는 `/ax-run <요구사항>`(그래프 순서로 진행), `/ax-loop <작업>`(검수 루프), `/ax-setup <단계>`(설정 변경)를 씁니다.
전체 설정은 `node .ax/bin/ax.cjs render --open`으로 한눈에 볼 수 있습니다.

자세한 구조와 동작: [.ax/README.md](.ax/README.md)

## 킷 자체를 개선할 때
이 저장소에서 바로 수정하고 `node --test .ax/tests/*.test.cjs`로 검증합니다. (init하지 않습니다.)
