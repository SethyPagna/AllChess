import pickle
import os

class SaveGame:

    @staticmethod
    def save_game(game, filename: str = "game.jungle"):
        """
        Saves a Game object to the specified filename.
        Respects the path as provided by the caller.
        """

        try:
            # Only create directory if a path is specified
            directory = os.path.dirname(filename)
            if directory:
                os.makedirs(directory, exist_ok=True)

            with open(filename, "wb") as file:
                pickle.dump(game, file)

            return True

        except Exception as e:
            print(f"Error saving game: {e}")
            return False


    @staticmethod
    def load_game(filename: str = "game.jungle"):
        """
        Loads and returns a Game object.
        Returns None if file does not exist or loading fails.
        """

        if not os.path.exists(filename):
            return None

        try:
            with open(filename, "rb") as file:
                return pickle.load(file)
        except Exception as e:
            print(f"Error loading game: {e}")
            return None


    @staticmethod
    def get_jungle_save_files():
        """
        Returns all .jungle save files in the data directory.
        """

        folder_path = "data"
        os.makedirs(folder_path, exist_ok=True)

        return [
            f for f in os.listdir(folder_path)
            if f.endswith(".jungle") and os.path.isfile(os.path.join(folder_path, f))
        ]


    @staticmethod
    def get_jungle_record_files():
        """
        Returns all .record files in the data directory.
        """

        folder_path = "data"
        os.makedirs(folder_path, exist_ok=True)

        return [
            f for f in os.listdir(folder_path)
            if f.endswith(".record") and os.path.isfile(os.path.join(folder_path, f))
        ]
