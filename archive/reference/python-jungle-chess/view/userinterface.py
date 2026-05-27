import random
import string
from model.save_game import SaveGame
import time

class UserInterface:
    def __init__(self):
        self.commands = {
            'help': 'Show available commands',
            'move': 'Make a move (e.g., "e2 e4")',
            'history': 'Show move history',
            'status': 'Show current game status',
            'endturn' : 'End current player turn',
            'resign': 'Resign from the game',
            'undo': "Undo the most recent made move",
            'save': 'Save the current game',
            'load': 'Load a saved game',
            'record': 'Record move history to a file',
            'playback': 'Play back a recorded game',
            'quit': 'Exit the game'
            
        }
        self.playback_commands = {
            'next': 'Show next move in playback',
            'exit': 'Exit playback mode'
        }
    
    def display_welcome2(self):
        # Display a welcome message
        print("=" * 50)
        print("           WELCOME TO JUNGLE CHESS")
        print("=" * 50)
        while True:
            choice = input("Load saved game or start new? (load/new) or 'quit' to exit: ").strip().lower()
            print()
            if choice in ('quit', 'exit', 'q'):
                return "quit"
            if choice in ("load", "new"):
                return choice
            print("Please type 'load' or 'new'.")
            print()
            time.sleep(0.5)
        



    def get_user_input(self):
        # Get command input from the user
        try:
            user_input = input("\nEnter command: ").strip().lower()
            return user_input
        except (EOFError, KeyboardInterrupt):
            return "quit"
    #not used i think       
    def prompt_load_or_new(self) -> str:
        while True:
            choice = input("Load saved game or start new? (load/new): ").strip().lower()
            print()
            if choice in ("load", "new"):
                return choice
            print("Please type 'load' or 'new'.")
            print()
            time.sleep(0.5)

    def prompt_filename_load(self) -> str:
        while True: #try to remove this one
            available_files = SaveGame.get_jungle_save_files()
            if available_files:
                print("Available save files:")
                for f in available_files:
                    print(f" - {f}")
            filename = input("Enter filename you want to load(default 'game.jungle') or 'quit' to exit: ").strip()
            print()
            if filename == "":
                filename = "game.jungle"
            if filename.lower() in ('quit', 'exit', 'q'):
                return "quit"
            else :
                if not filename.endswith(".jungle"):
                    filename += ".jungle"
            if filename in available_files:
                return filename
            print(f"File '{filename}' does not exist give an existing file name.")
            print()
            time.sleep(0.5)

    def prompt_filename_playback(self) -> str:
        while True:
            available_files = SaveGame.get_jungle_record_files()
            if available_files:
                print("Available record files:")
                for f in available_files:
                    print(f" - {f}")
            filename = input("Enter filename you want to playback (default 'game.record') or 'quit' to exit: ").strip()
            print()
            if filename == "":
                filename = "game.record"
            if filename.lower() in ('quit', 'exit', 'q'):
                return "quit"
            else :
                if not filename.endswith(".record"):
                    filename += ".record"
            if filename in available_files:
                return filename
            print(f"File '{filename}' does not exist give an existing file name.")
            print()
            time.sleep(0.5)
        
    def prompt_filename_save(self) -> str:
        available_files = SaveGame.get_jungle_save_files()
        if available_files:
            print("Existing save files (don't pick the same name as it will overwrite):")
            for f in available_files:
                print(f" - {f}")
        filename = input("Enter filename to save the game (default 'game.jungle') or 'quit' to exit: ").strip()
        if filename == "":
            filename = "game.jungle"
        if filename.lower() in ('quit', 'exit', 'q'):
            return "quit"
        else :
            if not filename.endswith(".jungle"):
                filename += ".jungle"
        return filename
    
    def prompt_filename_record(self) -> str:
        available_files = SaveGame.get_jungle_record_files()
        if available_files:
            print("Existing save files (don't pick the same name as it will overwrite):")
            for f in available_files:
                print(f" - {f}")
        filename = input("Enter filename to record the game (default 'game.record') or 'quit' to exit: ").strip()
        if filename == "":
            filename = "game.record"
        if filename.lower() in ('quit', 'exit', 'q'):
            return "quit"
        else :
            if not filename.endswith(".record"):
                filename += ".record"
        return filename

    def confirm(self, prompt: str) -> bool:
        ans = input(prompt).strip().lower()
        return ans in ("y", "yes")
    
    def get_player_names(self):
        """Get player names from user input"""
        print("=== NEW GAME SETUP ===")
        player1 = input("Enter name for Player 1 (White): ").strip()
        player2 = input("Enter name for Player 2 (Black): ").strip()
        
        def generate_random_name():
            return ''.join(random.choices(string.ascii_letters + string.digits, k=8))
        
        if not player1:
            player1 = generate_random_name()
        if not player2:
            player2 = generate_random_name()
        
        player1 = "*" + player1 + "*"
        player2 = "#" + player2 + "#"
        
        return player1, player2

    def display_game_status(self, game):
        """Show the current game status"""
        if not game:
            print("No game in progress.")
            return

        print("\n" + "=" * 70)

        # Display current player
        
        current_player = game.players[game.whose_turn].name
        if current_player == game.players[0].name:
            position = "pieces marked with *"
        else: 
            position = "pieces marked with #"
        if game.players[game.whose_turn].moved_this_turn:
            current_turn = len(game.move_history)
        else:
            current_turn = len(game.move_history)+1
        
        print(f"Current turn: {current_turn} || Current player: {current_player} ({position})")

        print("=" * 70)

    def display_move_history(self, game):
        # Display the history of moves
        history = game.move_history
        if not history:
            print("No moves have been made yet.")
            return

        print("\n" + "=" * 40)
        print("MOVE HISTORY (piece_moved, from, to, captured_piece)")
        print("=" * 40)
        
        # Display moves in a chess notation format
        for i, move in enumerate(history, 1):
            move_number = (i + 1) // 2
            if i % 2 == 1:  # White's move
                print(f"{game.players[0].name} move {move_number}. {move}", end="")
            else:  # Black's move
                print(f"{game.players[1].name} move {move_number}. {move}")
        
        # If last move was white and no black response yet
        if len(history) % 2 == 1:
            print()  # New line for incomplete pair
        
        print("=" * 40)


    def display_board(self, board):
        print("\n        " + "            ".join("abcdefg"))

        for row in range(9):
            print("  ", end="")
            print(7*("+"+12*"-")+"+")
            print("  ", end="")
            print(7*("|"+12*" ")+"|")
            print(f"{9-row} ", end="")
            for col in range(7):
                
                cell = board[row][col]
                if cell[0] == None : 
                    symbol = cell[1][0] if cell[1][0] != 'land' else ''
                else :
                    symbol = cell[0].symbol
                
                print("|", end="")
                #print(symbol, end="        ")
                for i in range((12-len(symbol))//2):
                    print(end=" ")
                print(symbol, end="")
                for i in range(12-((12-len(symbol))//2)-len(symbol)):
                    print(end=" ")
            print("|", end="")
            print(f" {9-row}")
            print("  ", end="")
            print(7*("|"+12*" ")+"|", end="")
            print()  # New line after each row
        print("  ", end="")
        print(7*("+"+12*"-")+"+")

        print("\n        " + "            ".join("abcdefg"))


    def display_help(self):
        """Display available commands"""
        print("\n" + "=" * 50)
        print("AVAILABLE COMMANDS")
        print("=" * 50)
        for cmd, desc in self.commands.items():
            print(f"  {cmd:8} - {desc}")
        print("=" * 50)

    def display_help_playback(self):
        print("\n" + "=" * 50)
        print("AVAILABLE COMMANDS")
        print("=" * 50)
        for cmd, desc in self.playback_commands.items():
            print(f"  {cmd:8} - {desc}")
        print("=" * 50)


    def display_move_prompt(self, game):
        """Prompt for a move from the current player with validation"""
        player_name = game.players[game.whose_turn].name
        
        try:
            # Get and validate origin coordinate
            while True:
                user_input1 = input(f"\n{player_name}'s turn. Which piece do you want to move? Give coordinates (example: a2): ").strip().lower()
                
                if user_input1 in ('quit', 'exit', 'q'):
                    return "quit"
                
                if self._is_valid_coordinate(user_input1):
                    origin = user_input1
                    break
                else:
                    print(f"Invalid coordinate '{user_input1}'. Please use format like 'a2' (a-g and 1-9).")
            
            # Get and validate destination coordinate
            while True:
                user_input2 = input("Where do you want to move it to? Give coordinates (example: a3): ").strip().lower()
                
                if user_input2 in ('quit', 'exit', 'q'):
                    return "quit"
                
                if self._is_valid_coordinate(user_input2):
                    destination = user_input2
                    break
                else:
                    print(f"Invalid coordinate '{user_input2}'. Please use format like 'a3' (a-g and 1-9).")
                    time.sleep(0.5)
            
            return origin, destination
            
        except (EOFError, KeyboardInterrupt):
            return "quit"

    def _is_valid_coordinate(self, coord):
        """Validate coordinate format and bounds (a-g, 1-9)"""
        if not coord or len(coord) != 2:
            return False
        
        letter, number = coord[0], coord[1]
        
        # Check if letter is between 'a' and 'g'
        if not ('a' <= letter <= 'g'):
            return False
        
        # Check if number is between '1' and '9'
        if not ('1' <= number <= '9'):
            return False
        
        return True
 





    def display_game_result(self, winner):
        """Display game result (win, draw, resignation)"""
        print("\n" + "=" * 50)
        print("GAME OVER")
        print("=" * 50)
        
        
        print(winner + " wins!")

        print("=" * 50)





    def display_resignation(self, player_name):
        """Display resignation confirmation with validation"""
        while True:
                response = input(f"\n{player_name}, are you sure you want to resign? (y/n): ").strip().lower()
                # Handle empty input
                if response == "":
                    print("Please enter 'y' for yes or 'n' for no.")
                    continue
                # Handle affirmative responses
                if response in ['y', 'yes', 'quit', 'exit']:
                    return True
                # Handle negative responses  
                if response in ['n', 'no']:
                    return False
                # Handle invalid input
                print(f"Invalid response '{response}'. Please enter 'y' for yes or 'n' for no.")
        

    def display_quit_confirmation(self):
        """Ask for confirmation before quitting"""
        response = input("\nAre you sure you want to quit? (y/n): ").strip().lower()
        return response in ['y', 'yes']
    
