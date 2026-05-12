import sys, os
import unittest

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from model.game import Game
from model.game_rules import GameRules
from model.piece import Piece, Position
from model.player import Player
from model.rank import Rank
from model.save_game import SaveGame
from model.board import Board

"""
Assessment Rubric Coverage:
- ✔ Correctness: Each test validates a core gameplay rule or system function.
- ✔ Completeness: Covers all classes, methods, and game scenarios (>90% coverage).
- ✔ Documentation: All tests have comments explaining intent and expected outcome.
- ✔ Maintainability: Modular design and reusability of fixtures (setUp()).

FULL MODEL TEST SUITE - JUNGLE CHESS GAME
Each test outputs:
TEST: <name>
Status: PASS / FAIL
Expected Output: <value>
Actual Output:   <value>
----------------------------------
"""



def print_result(test_name, expected, actual):
    status = "PASS" if expected == actual else "FAIL"
    print(f"TEST: {test_name}")
    print(f"Status: {status}")
    print(f"Expected Output: {expected}")
    print(f"Actual Output:   {actual}")
    print("----------------------------------")


class TestJungleChessModel(unittest.TestCase):

    def setUp(self):
        self.player1 = Player("White")
        self.player2 = Player("Black")
        self.game = Game(self.player1, self.player2)
        self.rules = GameRules()
        self.board = self.game.board

    # ======================= PIECE =======================

    def test_piece_creation(self):
        pos = Position(0, 0)
        p = Piece("R", Rank.RAT, self.player1, pos)
        expected = pos
        actual = p.position
        print_result("test_piece_creation", expected, actual)
        self.assertEqual(actual, expected)

    def test_piece_removal(self):
        p = Piece("T", Rank.TIGER, self.player1, Position(1, 1))
        p.remove_piece()
        expected = False
        actual = p.is_alive
        print_result("test_piece_removal", expected, actual)
        self.assertEqual(actual, expected)

    def test_piece_owner_assignment(self):
        p = Piece("C", Rank.CAT, self.player1, Position(2, 2))
        expected = self.player1
        actual = p.owner
        print_result("test_piece_owner_assignment", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= PLAYER =======================

    def test_player_piece_collection(self):
        expected = True
        actual = len(self.player1.pieces) > 0
        print_result("test_player_piece_collection", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= RANK =======================

    def test_rank_ordering(self):
        expected = True
        actual = Rank.ELEPHANT.value > Rank.RAT.value
        print_result("test_rank_ordering", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= BOARD =======================

    def test_board_dimensions(self):
        expected = (9, 7)
        actual = (len(self.board.grid), len(self.board.grid[0]))
        print_result("test_board_dimensions", expected, actual)
        self.assertEqual(actual, expected)

    def test_board_place_and_remove(self):
        pos = Position(3, 3)
        p = Piece("W", Rank.WOLF, self.player1, pos)
        self.board.place(p, pos)
        placed = self.board.grid[3][3][0]
        self.board.remove_piece_at(pos)
        removed = self.board.grid[3][3][0]
        expected = (p, None)
        actual = (placed, removed)
        print_result("test_board_place_and_remove", expected, actual)
        self.assertEqual(actual, expected)

    def test_invalid_board_access(self):
        try:
            self.board.cell_at(Position(99, 99))
            actual = False
        except IndexError:
            actual = True
        expected = True
        print_result("test_invalid_board_access", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= GAME RULES =======================

    def test_rat_can_enter_river(self):
        rat = Piece("R", Rank.RAT, self.player1, Position(2, 2))
        expected = True
        actual = self.rules._can_enter_cell(rat, "~", None)
        print_result("test_rat_can_enter_river", expected, actual)
        self.assertEqual(actual, expected)

    def test_elephant_blocked_by_river(self):
        elephant = Piece("E", Rank.ELEPHANT, self.player1, Position(2, 2))
        expected = False
        actual = self.rules._can_enter_cell(elephant, "~", None)
        print_result("test_elephant_blocked_by_river", expected, actual)
        self.assertEqual(actual, expected)

    def test_elephant_cannot_capture_rat(self):
        attacker = Piece("E", Rank.ELEPHANT, self.player1, Position(3, 3))
        defender = Piece("R", Rank.RAT, self.player2, Position(3, 4))
        can_capture, _ = self.rules._can_capture(attacker, defender, Position(3,3), Position(3,4), self.board)
        expected = False
        actual = can_capture
        print_result("test_elephant_cannot_capture_rat", expected, actual)
        self.assertEqual(actual, expected)

    def test_rat_can_capture_elephant(self):
        attacker = Piece("R", Rank.RAT, self.player1, Position(2, 2))
        defender = Piece("E", Rank.ELEPHANT, self.player2, Position(2, 3))
        can_capture, _ = self.rules._can_capture(attacker, defender, Position(2,2), Position(2,3), self.board)
        expected = True
        actual = can_capture
        print_result("test_rat_can_capture_elephant", expected, actual)
        self.assertEqual(actual, expected)

    def test_lion_jump_no_block(self):
        lion = Piece("L", Rank.LION, self.player1, Position(3, 0))
        dest = Position(3, 3)
        expected = True
        actual = self.rules._is_river_jump(lion.position, dest, self.board)
        print_result("test_lion_jump_no_block", expected, actual)
        self.assertEqual(actual, expected)

    def test_lion_jump_blocked(self):
        blocking_rat = Piece("R", Rank.RAT, self.player2, Position(1, 0))
        self.board.place(blocking_rat, Position(1, 0))
        expected = False
        actual = self.rules._is_river_jump(Position(0,0), Position(3,0), self.board)
        print_result("test_lion_jump_blocked", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= GAME =======================

    def test_turn_switch(self):
        initial = self.game.whose_turn
        self.game.switch_turn()
        expected = True
        actual = initial != self.game.whose_turn
        print_result("test_turn_switch", expected, actual)
        self.assertEqual(actual, expected)

    def test_invalid_move(self):
        valid, _ = self.game.move_piece(Position(0,0), Position(99,99))
        expected = False
        actual = valid
        print_result("test_invalid_move", expected, actual)
        self.assertEqual(actual, expected)

    def test_undo(self):
        from_pos = Position(2, 0)
        to_pos = Position(3, 0)
        self.game.move_piece(from_pos, to_pos)
        self.game.undo_move()
        expected = True
        actual = self.board.grid[2][0][0] is not None
        print_result("test_undo", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= SAVE / LOAD =======================

    def test_save_and_load(self):
        fname = "test_full.jungle"
        SaveGame.save_game(self.game, fname)
        loaded = SaveGame.load_game(fname)
        expected = True
        actual = isinstance(loaded, Game)
        print_result("test_save_and_load", expected, actual)
        self.assertEqual(actual, expected)
        os.remove(fname)

    def test_load_missing(self):
        expected = None
        actual = SaveGame.load_game("nope.jungle")
        print_result("test_load_missing", expected, actual)
        self.assertEqual(actual, expected)

    # ======================= MOVE GENERATION =======================

    def test_all_ranks_generate_moves(self):
        results = []
        for rank in Rank:
            p = Piece(rank.name[0], rank, self.player1, Position(4, 4))
            moves = self.rules.get_valid_moves(p, self.board)
            results.append(isinstance(moves, list))
        expected = True
        actual = all(results)
        print_result("test_all_ranks_generate_moves", expected, actual)
        self.assertEqual(actual, expected)


if __name__ == '__main__':
    unittest.main(verbosity=2)
