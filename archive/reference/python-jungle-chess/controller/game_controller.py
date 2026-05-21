from model.game import Game
from model.player import Player
from model.save_game import SaveGame
from model.piece import Position
import sys
import time
import traceback

class GameController:
    def __init__(self, ui):
        self.ui = ui
        self.game = None
        self.display_board = True
        self.backup_game = None


    @staticmethod
    def convert_coordinate(coord):
        """
        Convert a human-readable coordinate like 'a1' to internal (row, col) indices.

        Board is assumed to have:
        - columns labeled 'a'..'g' (0..6)
        - rows 1..9, where '9' is the top row (row_index 0) and '1' is the bottom (row_index 8).
        """
        if len(coord) != 2:
            raise ValueError("Coordinate must be 2 characters (e.g., 'a1', 'g9')")
        letter = coord[0].lower()
        number = coord[1]
        col_index = ord(letter) - ord('a')
        row_index = 9 - int(number)
        return row_index, col_index

    @staticmethod
    def convert_indices_to_coordinate(row, col):
        """
        Convert internal (row, col) indices back to a human-readable coordinate like 'a1'.
        Inverse of convert_coordinate.
        """
        if not (0 <= row <= 8 and 0 <= col <= 6):
            raise ValueError("Row must be 0-8, col must be 0-6")
        letter = chr(ord('a') + col)
        number = 9 - row
        return f"{letter}{number}"

    def initialize_game(self):
        """
        Entry point to set up a new or loaded game.
        Asks the UI whether to start new, load, or quit.
        """
        choice = self.ui.display_welcome2()
        if choice == "quit":
            sys.exit(0)

        if choice == "load":
            filename = self.ui.prompt_filename_load()
            if filename == 'quit':
                sys.exit(0)
            self.game = SaveGame.load_game(filename)
            if self.game is None:
                if self.ui.confirm("Start a new game instead? (y/n):"):
                    player1_name, player2_name = self.ui.get_player_names()
                    self.game = Game(Player(player1_name), Player(player2_name))
                else:
                    print("No game to run. Exiting.")
                    sys.exit(0)
        else:
            player1_name, player2_name = self.ui.get_player_names()
            self.game = Game(Player(player1_name), Player(player2_name))

    def start_game_loop(self):
        """
        Main loop for the controller.
        Switches between playback mode and normal play mode,
        and handles top-level exceptions and quitting.
        """
        while True:
            try:
                if self.game.recording:
                    self.playback_mode()
                    

                else:
                    self.play_mode()
            except KeyboardInterrupt:
                if self.ui.display_quit_confirmation():
                    print("Thanks for playing!")
                    break
            except Exception as e:
                print(f"An error occurred: {e}")
                traceback.print_exc()
                if self.ui.confirm("Continue playing? (y/n): "):
                    continue
                else:
                    break

    # ---------------- Playback Mode ----------------
    def playback_mode(self):
        """
        Playback mode: replays recorded moves of a previous game.
        User can type 'next' to step through moves or 'exit' to leave playback.
        """
        self.ui.display_board(self.game.board.grid)
        print("\nPlayback Mode Commands: 'next' to play next move, 'exit' to return to main menu")

        try:
            user_input = self.ui.get_user_input()
            if user_input == 'next':
                time.sleep(0.5)
                self.play_next_move()
            elif user_input == 'exit':
                self.game.recording = False
                self.display_board = True
            else:
                print("Invalid command. Type 'next' or 'exit'.")
                time.sleep(0.5)
        except Exception as e:
            print(f"An error occurred during playback: {e}")

    def play_next_move(self):
        """
        Plays the next recorded move from move_history during playback.
        """
        if not self.game.move_history:
            print("End of playback reached.")
            time.sleep(0.5)
            return
        move = self.game.move_history.pop(0)
        origin = Position(*self.convert_coordinate(move[1]))
        destination = Position(*self.convert_coordinate(move[2]))
        self.game.move_piece(origin, destination)
        self.game.switch_turn()
        print(f"Replaying move: {move}")
        time.sleep(0.5)

    # ---------------- Play Mode ----------------
    def play_mode(self):
        """
        Normal game mode where players enter commands (move, save, undo, etc.).
        Handles one command per call.
        """
        if self.backup_game:
            self.game = self.backup_game
            self.backup_game = None
        if self.display_board:
            self.ui.display_board(self.game.board.grid)
            if not self.game.completed:
                self.ui.display_game_status(self.game)
            else:
                self.ui.display_game_result(self.game.players[self.game.whose_turn].name)
            self.ui.display_help()
        self.display_board = True

        user_input = self.ui.get_user_input()
        command_map = {
            'help': self.ui.display_help,
            'h': self.ui.display_help,
            'status': lambda: None,
            'move': self.handle_move,
            'm': self.handle_move,
            'history': self.handle_history,
            'resign': self.handle_resign,
            'undo': self.handle_undo,
            'load': self.handle_load,
            'save': self.handle_save,
            'record': self.handle_record,
            'playback': self.handle_playback,
            'endturn': self.handle_endturn,
            'et': self.handle_endturn,
            'quit': self.handle_quit,
            'q': self.handle_quit
        }

        handler = command_map.get(user_input, self.invalid_command)
        handler()
        time.sleep(0.5)

    # ---------------- Command Handlers ----------------
    def handle_move(self):
        """
        Handle a 'move' command: ask for origin and destination,
        validate and apply the move, and check for victory.
        """
        if self.game.completed:
            print("The game has ended. You cannot perform new moves")
            return
        origin, destination = self.ui.display_move_prompt(self.game)
        origin_pos = Position(*self.convert_coordinate(origin))
        dest_pos = Position(*self.convert_coordinate(destination))
        result, message = self.game.move_piece(origin_pos, dest_pos)
        print(message)
        if result:
            mover = self.game.players[self.game.whose_turn]
            won, winner_idx = self.game.check_victory(mover, dest_pos)
            if won:
                self.ui.display_game_result(self.game.players[winner_idx].name)
                self.game.completed = True
            self.display_board = True
        else:
            self.display_board = False

    def handle_history(self):
        """
        Display the list of moves played so far.
        """
        self.ui.display_move_history(self.game)
        self.display_board = False

    def handle_resign(self):
        """
        Handle current player resignation and end the game.
        """
        if self.game.completed:
            print("The game has ended. You cannot resign now.")
            return
        if self.ui.display_resignation(self.game.players[self.game.whose_turn].name):
            print(f"{self.game.players[self.game.whose_turn].name} has resigned")
            self.game.switch_turn()
            self.ui.display_game_result(self.game.players[self.game.whose_turn].name)
            self.game.completed = True
        self.display_board = False

    def handle_undo(self):
        """
        Undo the last move if possible and decrement the undo counter
        for the player who uses it.
        """
        if self.game.completed:
            print("The game has ended. You cannot undo moves now.")
            return
        if not self.game.move_stack:
            print("No moves to undo.")
            return

        move = self.game.move_stack.pop()
        if self.game.players[move["prev_turn"]].undos <= 0:
            print(f'No undos left for {self.game.players[move["prev_turn"]].name}.')
            self.game.move_stack.append(move)
            return
        else:
            self.game.move_stack.append(move)
            result, message = self.game.undo_move()
            print(message)
            if result:
                print(f"{self.game.players[self.game.whose_turn].name} has used an undo. Remaining undos: {self.game.players[self.game.whose_turn].undos-1}")
                self.game.players[self.game.whose_turn].undos -= 1
        self.display_board = True

    def handle_load(self):
        """
        Load a saved game from a file and replace the current game.
        """
        filename = self.ui.prompt_filename_load()
        if filename == 'quit':
            return
        loaded_game = SaveGame.load_game(filename)
        if loaded_game:
            self.game = loaded_game
            print(f"Game loaded from {filename}")
        else:
            print(f"Failed to load game from {filename}")
        self.display_board = True

    def handle_save(self):
        """
        Save the current game state to a file.
        """
        filename = self.ui.prompt_filename_save()
        if filename in ('quit', 'exit', 'q'):
            return
        SaveGame.save_game(self.game, filename)
        print(f"Game saved to '{filename}'")
        self.display_board = False

    def handle_record(self):
        """
        Record (save) the current game for later playback.
        Typically similar to save, but semantically meant for replay.
        """
        filename = self.ui.prompt_filename_record()
        if filename == 'quit':
            return
        SaveGame.save_game(self.game, filename)
        print(f"Game recorded to '{filename}'")
        self.display_board = False

    def handle_playback(self):
        """
        Enter playback mode using a previously recorded game.
        The current game is stored in backup_game and restored after playback.
        """
        filename = self.ui.prompt_filename_playback()
        if filename == 'quit':
            return
        playback_game = SaveGame.load_game(filename)
        if playback_game:
            self.backup_game = self.game

            self.game = Game(playback_game.players[0], playback_game.players[1])
            self.game.move_history = playback_game.move_history
            self.game.recording = True
            print(f"Game loaded for playback from {filename}")
        else:
            print(f"Failed to load game from {filename}")
        self.display_board = False

    def handle_endturn(self):
        """
        Explicitly end the current player's turn, if they've made a move.
        """
        if self.game.completed:
            print("The game has ended. You cannot end turns now.")
            return
        if not self.game.players[self.game.whose_turn].moved_this_turn:
            print("You must make a move before ending your turn.")
        else:
            self.game.switch_turn()

    def handle_quit(self):
        """
        Handle quitting from within the game (not via KeyboardInterrupt).
        """
        if self.ui.display_quit_confirmation():
            print("Thanks for playing!")
            sys.exit(0)

    def invalid_command(self):
        """
        Fallback handler when user enters an unrecognized command.
        """
        print("Invalid command. Type 'help' or 'h' for a list of commands.")
        self.display_board = False