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
}
