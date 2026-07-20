function currentColor() {
    return COLORS[currentPlayerIdx];
}

function computeMovable(color, roll) {
    const list = [];

    pawns[color].forEach((pawn, i) => {
        if (pawn.k === -1) {
            if (roll === 6) list.push(i);
        } else if (pawn.k < 56) {
            const newK = pawn.k + roll;
            if (newK <= 56) list.push(i);
        }
    });

    return list;
}

function clearMovableHighlights() {
    COLORS.forEach(c =>
        pawns[c].forEach(p => {
            p._pulse = false;
            p.mesh.scale.set(1, 1, 1);
        })
    );
}

function highlightMovable(color, indices) {
    indices.forEach(i => {
        pawns[color][i]._pulse = true;
    });
}

function evaluateAvailableMoves() {

    clearMovableHighlights();

    const color = currentColor();

    if (currentTurnMoves.length === 0) {
        advanceTurn(isDoubleRoll);
        return;
    }

    let totalValidPawns = [];

    currentTurnMoves.forEach(move => {
        computeMovable(color, move).forEach(pIdx => {
            if (totalValidPawns.indexOf(pIdx) === -1)
                totalValidPawns.push(pIdx);
        });
    });

    if (totalValidPawns.length === 0) {

        showMsg("لا يوجد حركات متاحة — ينتقل الدور");

        gameState = "awaiting_move";

        setTimeout(() => {
            advanceTurn(false);
        }, 1300);

    } else {

        highlightMovable(color, totalValidPawns);

        showMsg(
            "انقر على الحجر المضيء — النرد المتبقي: " +
            currentTurnMoves.join(", ")
        );

        if (gameMode !== "passplay" && isBotTurn) {

            document
                .getElementById("bot-thinking")
                .classList.add("show");

            setTimeout(() => {

                document
                    .getElementById("bot-thinking")
                    .classList.remove("show");

                executeBotMove();

            }, 1000 + Math.random() * 1000);
        }
    }
}function tryMovePawn(color, idx) {
    if (gameState !== "awaiting_move") return;
    if (color !== currentColor()) return;
    if (gameMode !== "passplay" && isBotTurn) return;

    const validMoves = currentTurnMoves.filter(
        move => computeMovable(color, move).indexOf(idx) !== -1
    );

    if (validMoves.length === 0) return;

    const uniqueMoves = validMoves.filter(
        (v, i) => validMoves.indexOf(v) === i
    );

    if (uniqueMoves.length === 1) {
        executeMove(color, idx, uniqueMoves[0]);
    } else {
        showMovePickerUI(color, idx, uniqueMoves);
    }
}

function executeMove(color, idx, steps) {

    const usedAt = currentTurnMoves.indexOf(steps);
    if (usedAt > -1)
        currentTurnMoves.splice(usedAt, 1);

    clearMovableHighlights();

    gameState = "animating";

    const pawn = pawns[color][idx];

    const fromK = pawn.k;
    const toK = fromK === -1 ? 0 : fromK + steps;

    const waypoints = [];

    if (fromK === -1)
        waypoints.push(0);
    else
        for (let k = fromK + 1; k <= toK; k++)
            waypoints.push(k);

    animateAlong(pawn, color, waypoints, () => {

        pawn.k = toK;

        const captured = handleCapture(color, toK);

        if (toK === 56)
            playChimeUp();
        else if (captured)
            playCapture();
        else
            playHop();

        if (captured)
            gameStats.captures++;

        if (gameMode === "challenge" && captured) {
            challengeProgress.current++;
            updateChallengeHUD();
        }

        if (checkWin(color)) {
            showWin(color);
            gameState = "over";
            return;
        }

        gameState = "awaiting_move";

        evaluateAvailableMoves();

    });

}
